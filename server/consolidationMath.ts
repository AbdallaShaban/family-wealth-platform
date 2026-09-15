import Decimal from "decimal.js";

export type FxRateInfo = {
  rate: Decimal;
  source: string;
  asOf: number;
  isStale?: boolean;
};

export type FxRateResolver = (fromCurrency: string, toCurrency: string) => FxRateInfo | null;

export type RawWorkspaceEntity = {
  workspaceId: number;
  workspaceName: string;
  baseCurrency: string;
  role: string;
  grossBookNetWorth: Decimal;
  economicNetWorth: Decimal;
  liquidCash: Decimal;
  investmentValue: Decimal;
  assetValue: Decimal;
  liabilities: Decimal;
  accounts: Array<{
    id: number;
    name: string;
    accountType: string;
    currency: string;
    balance: Decimal;
  }>;
  portfolio: Array<{
    instrumentId: number;
    instrumentName: string;
    assetType: string;
    quantity: Decimal;
    currency: string;
    marketValue: Decimal;
  }>;
  debts: Array<{
    id: number;
    creditorName: string | null;
    liabilityAccountId: number;
    outstandingBalance: Decimal;
    currency: string;
  }>;
  ious: Array<{
    id: number;
    counterpartyName: string;
    direction: "receivable" | "payable";
    amount: Decimal;
    currency: string;
    status: string;
  }>;
};

export type ConsolidatedWorkspaceBreakdown = {
  workspaceId: number;
  workspaceName: string;
  baseCurrency: string;
  role: string;
  fxRateToPresentation: string;
  fxRateStatus: "identity" | "authoritative" | "stale" | "missing";
  fxRateAsOf: number | null;
  grossBookNetWorthLocal: string;
  grossBookNetWorthConverted: string;
  economicNetWorthLocal: string;
  economicNetWorthConverted: string;
  liquidCashConverted: string;
  investmentValueConverted: string;
  liabilitiesConverted: string;
  totalAssetsConverted: string;
};

export type ConsolidatedAssetAllocationItem = {
  assetClass: string;
  labelAr: string;
  amountConverted: string;
  weightPercentage: string;
};

export type InterEntityDisclosureItem = {
  sourceWorkspaceId: number;
  sourceWorkspaceName: string;
  counterpartyName: string;
  claimType: "personal_iou_receivable" | "personal_iou_payable" | "debt_liability";
  amountOriginal: string;
  currency: string;
  amountConverted: string;
  disclosureNote: string;
  eliminationStatus: "DISCLOSED_NOT_ELIMINATED";
};

export type ConsolidatedSummaryResult = {
  presentationCurrency: string;
  generatedAt: number;
  workspaceCount: number;
  grossConsolidatedBookNetWorth: string;
  grossConsolidatedEconomicNetWorth: string;
  totalConsolidatedAssets: string;
  totalConsolidatedLiabilities: string;
  totalDisclosedInterEntityClaims: string;
  netWorthPostDisclosureRange: {
    gross: string;
    minAssumingAllInterEntityEliminated: string;
    disclosureNote: string;
  };
  workspaces: ConsolidatedWorkspaceBreakdown[];
  assetAllocation: ConsolidatedAssetAllocationItem[];
  interEntityDisclosures: InterEntityDisclosureItem[];
  hasMissingRates: boolean;
  missingRatePairs: Array<{ from: string; to: string; workspaceId: number; workspaceName: string }>;
  isConsolidationBlocked: boolean;
  blockReasonAr?: string;
  epistemology: {
    classification: "EMPIRICAL_OBSERVATION";
    consolidationType: "GROSS_COMBINED_WITH_DISCLOSURE";
    eliminationPolicy: "NO_SPECULATIVE_ELIMINATIONS_WITHOUT_VERIFIED_DOCUMENTED_RELATION";
  };
};

/**
 * Deterministically translates an amount from currency A to B using provided resolver.
 */
export function convertAmount(
  amount: Decimal,
  fromCurrency: string,
  toCurrency: string,
  fxResolver: FxRateResolver
): { converted: Decimal; status: "identity" | "authoritative" | "stale" | "missing"; rate: Decimal; asOf: number | null } {
  const from = fromCurrency.trim().toUpperCase();
  const to = toCurrency.trim().toUpperCase();

  if (from === to) {
    return { converted: amount, status: "identity", rate: new Decimal(1), asOf: Date.now() };
  }

  const rateInfo = fxResolver(from, to);
  if (!rateInfo || rateInfo.rate.lte(0)) {
    // Missing rate: do not guess or zero out silently! Mark as missing and preserve unit
    return { converted: amount, status: "missing", rate: new Decimal(1), asOf: null };
  }

  const converted = amount.mul(rateInfo.rate);
  return {
    converted,
    status: rateInfo.isStale ? "stale" : "authoritative",
    rate: rateInfo.rate,
    asOf: rateInfo.asOf,
  };
}

/**
 * Consolidates multiple workspaces into an executive Gross Combined Portfolio.
 * Adheres to strict Zero-Journal and Non-Speculative Elimination rules.
 */
export function calculateConsolidation(
  entities: RawWorkspaceEntity[],
  presentationCurrency: string,
  fxResolver: FxRateResolver
): ConsolidatedSummaryResult {
  const targetCurrency = presentationCurrency.trim().toUpperCase();

  let grossBookNetWorthTotal = new Decimal(0);
  let grossEconomicNetWorthTotal = new Decimal(0);
  let totalAssetsTotal = new Decimal(0);
  let totalLiabilitiesTotal = new Decimal(0);
  let totalDisclosedClaims = new Decimal(0);

  // Asset class buckets
  let cashTotal = new Decimal(0);
  let equitiesTotal = new Decimal(0);
  let realEstateTotal = new Decimal(0);
  let preciousMetalsTotal = new Decimal(0);
  let otherAssetsTotal = new Decimal(0);

  const workspaceBreakdowns: ConsolidatedWorkspaceBreakdown[] = [];
  const disclosures: InterEntityDisclosureItem[] = [];
  const missingRatePairs: Array<{ from: string; to: string; workspaceId: number; workspaceName: string }> = [];

  for (const entity of entities) {
    const fx = convertAmount(new Decimal(1), entity.baseCurrency, targetCurrency, fxResolver);
    if (fx.status === "missing" && entity.baseCurrency.toUpperCase() !== targetCurrency) {
      missingRatePairs.push({
        from: entity.baseCurrency,
        to: targetCurrency,
        workspaceId: entity.workspaceId,
        workspaceName: entity.workspaceName,
      });
    }

    const convertedBookNetWorth = entity.grossBookNetWorth.mul(fx.rate);
    const convertedEconomicNetWorth = entity.economicNetWorth.mul(fx.rate);
    const convertedLiquidCash = entity.liquidCash.mul(fx.rate);
    const convertedInvestment = entity.investmentValue.mul(fx.rate);
    const convertedLiabilities = entity.liabilities.mul(fx.rate);
    const convertedTotalAssets = convertedLiquidCash.plus(convertedInvestment).plus(entity.assetValue.mul(fx.rate));

    grossBookNetWorthTotal = grossBookNetWorthTotal.plus(convertedBookNetWorth);
    grossEconomicNetWorthTotal = grossEconomicNetWorthTotal.plus(convertedEconomicNetWorth);
    totalAssetsTotal = totalAssetsTotal.plus(convertedTotalAssets);
    totalLiabilitiesTotal = totalLiabilitiesTotal.plus(convertedLiabilities);

    workspaceBreakdowns.push({
      workspaceId: entity.workspaceId,
      workspaceName: entity.workspaceName,
      baseCurrency: entity.baseCurrency,
      role: entity.role,
      fxRateToPresentation: fx.rate.toFixed(6),
      fxRateStatus: fx.status,
      fxRateAsOf: fx.asOf,
      grossBookNetWorthLocal: entity.grossBookNetWorth.toFixed(2),
      grossBookNetWorthConverted: convertedBookNetWorth.toFixed(2),
      economicNetWorthLocal: entity.economicNetWorth.toFixed(2),
      economicNetWorthConverted: convertedEconomicNetWorth.toFixed(2),
      liquidCashConverted: convertedLiquidCash.toFixed(2),
      investmentValueConverted: convertedInvestment.toFixed(2),
      liabilitiesConverted: convertedLiabilities.toFixed(2),
      totalAssetsConverted: convertedTotalAssets.toFixed(2),
    });

    // Asset allocation breakdown
    for (const acc of entity.accounts) {
      if (acc.balance.lte(0)) continue;
      const accFx = convertAmount(acc.balance, acc.currency, targetCurrency, fxResolver);
      if (["cash", "bank", "brokerage", "wallet"].includes(acc.accountType)) {
        cashTotal = cashTotal.plus(accFx.converted);
      } else if (acc.accountType === "asset") {
        otherAssetsTotal = otherAssetsTotal.plus(accFx.converted);
      }
    }

    for (const pos of entity.portfolio) {
      if (pos.marketValue.lte(0)) continue;
      const posFx = convertAmount(pos.marketValue, pos.currency, targetCurrency, fxResolver);
      const assetType = pos.assetType.toLowerCase();
      if (assetType === "equity" || assetType === "fund") {
        equitiesTotal = equitiesTotal.plus(posFx.converted);
      } else if (assetType === "real_estate" || assetType === "property") {
        realEstateTotal = realEstateTotal.plus(posFx.converted);
      } else if (assetType === "gold" || assetType === "commodity") {
        preciousMetalsTotal = preciousMetalsTotal.plus(posFx.converted);
      } else {
        otherAssetsTotal = otherAssetsTotal.plus(posFx.converted);
      }
    }

    // Inter-entity Disclosures: Inspect IOUs and debts with counterparty mentions
    for (const iou of entity.ious) {
      if (iou.status !== "active") continue;
      const iouFx = convertAmount(iou.amount, iou.currency, targetCurrency, fxResolver);
      totalDisclosedClaims = totalDisclosedClaims.plus(iouFx.converted);

      disclosures.push({
        sourceWorkspaceId: entity.workspaceId,
        sourceWorkspaceName: entity.workspaceName,
        counterpartyName: iou.counterpartyName,
        claimType: iou.direction === "receivable" ? "personal_iou_receivable" : "personal_iou_payable",
        amountOriginal: iou.amount.toFixed(2),
        currency: iou.currency,
        amountConverted: iouFx.converted.toFixed(2),
        disclosureNote: `مستحق شخصي (${iou.direction === "receivable" ? "له" : "عليه"}) لدى "${iou.counterpartyName}". لم يتم الإلغاء لعدم وجود ربط قانوني معتمد.`,
        eliminationStatus: "DISCLOSED_NOT_ELIMINATED",
      });
    }

    for (const debt of entity.debts) {
      if (debt.outstandingBalance.lte(0)) continue;
      const debtFx = convertAmount(debt.outstandingBalance, debt.currency, targetCurrency, fxResolver);
      disclosures.push({
        sourceWorkspaceId: entity.workspaceId,
        sourceWorkspaceName: entity.workspaceName,
        counterpartyName: debt.creditorName || "دائن غير مسمى",
        claimType: "debt_liability",
        amountOriginal: debt.outstandingBalance.toFixed(2),
        currency: debt.currency,
        amountConverted: debtFx.converted.toFixed(2),
        disclosureNote: `التزام دين قائم على مساحة "${entity.workspaceName}". يتم الإفصاح عنه دون شطب بيني افتراضي.`,
        eliminationStatus: "DISCLOSED_NOT_ELIMINATED",
      });
    }
  }

  // Calculate percentage allocation
  const totalAllocatedAssets = cashTotal.plus(equitiesTotal).plus(realEstateTotal).plus(preciousMetalsTotal).plus(otherAssetsTotal);
  const safeDenominator = totalAllocatedAssets.gt(0) ? totalAllocatedAssets : new Decimal(1);

  const assetAllocation: ConsolidatedAssetAllocationItem[] = [
    {
      assetClass: "liquid_cash",
      labelAr: "النقد والودائع السائلة",
      amountConverted: cashTotal.toFixed(2),
      weightPercentage: totalAllocatedAssets.gt(0) ? cashTotal.div(safeDenominator).mul(100).toFixed(2) : "0.00",
    },
    {
      assetClass: "equities",
      labelAr: "الأسهم والصناديق الاستثمارية",
      amountConverted: equitiesTotal.toFixed(2),
      weightPercentage: totalAllocatedAssets.gt(0) ? equitiesTotal.div(safeDenominator).mul(100).toFixed(2) : "0.00",
    },
    {
      assetClass: "real_estate",
      labelAr: "العقارات والأصول الثابتة",
      amountConverted: realEstateTotal.toFixed(2),
      weightPercentage: totalAllocatedAssets.gt(0) ? realEstateTotal.div(safeDenominator).mul(100).toFixed(2) : "0.00",
    },
    {
      assetClass: "precious_metals",
      labelAr: "المعادن الثمينة والذهب",
      amountConverted: preciousMetalsTotal.toFixed(2),
      weightPercentage: totalAllocatedAssets.gt(0) ? preciousMetalsTotal.div(safeDenominator).mul(100).toFixed(2) : "0.00",
    },
    {
      assetClass: "other",
      labelAr: "أصول أخرى ومقتنيات خاصة",
      amountConverted: otherAssetsTotal.toFixed(2),
      weightPercentage: totalAllocatedAssets.gt(0) ? otherAssetsTotal.div(safeDenominator).mul(100).toFixed(2) : "0.00",
    },
  ];

  // Range of net worth: Gross vs conservative Net-of-disclosed-claims
  const minAssumingEliminated = grossEconomicNetWorthTotal.minus(totalDisclosedClaims).clamp(0, grossEconomicNetWorthTotal);

  return {
    presentationCurrency: targetCurrency,
    generatedAt: Date.now(),
    workspaceCount: entities.length,
    grossConsolidatedBookNetWorth: grossBookNetWorthTotal.toFixed(2),
    grossConsolidatedEconomicNetWorth: grossEconomicNetWorthTotal.toFixed(2),
    totalConsolidatedAssets: totalAssetsTotal.toFixed(2),
    totalConsolidatedLiabilities: totalLiabilitiesTotal.toFixed(2),
    totalDisclosedInterEntityClaims: totalDisclosedClaims.toFixed(2),
    netWorthPostDisclosureRange: {
      gross: grossEconomicNetWorthTotal.toFixed(2),
      minAssumingAllInterEntityEliminated: minAssumingEliminated.toFixed(2),
      disclosureNote: "الصافي الإجمالي يجمع صافي الثروة لكل كيان بدقة دفترية. النطاق الأدنى يوضح الأثر التحفظي في حال تطابقت الالتزامات والمستحقات البينية بالكامل.",
    },
    workspaces: workspaceBreakdowns,
    assetAllocation,
    interEntityDisclosures: disclosures,
    hasMissingRates: missingRatePairs.length > 0,
    missingRatePairs,
    isConsolidationBlocked: missingRatePairs.length > 0,
    blockReasonAr: missingRatePairs.length > 0
      ? `يوجد نقص في أسعار الصرف الموثقة لـ (${missingRatePairs.length}) كيان مقابل عملة العرض (${targetCurrency}). تم حظر توحيد القيم لمنع الاعتماد الافتراضي 1:1.`
      : undefined,
    epistemology: {
      classification: "EMPIRICAL_OBSERVATION",
      consolidationType: "GROSS_COMBINED_WITH_DISCLOSURE",
      eliminationPolicy: "NO_SPECULATIVE_ELIMINATIONS_WITHOUT_VERIFIED_DOCUMENTED_RELATION",
    },
  };
}
