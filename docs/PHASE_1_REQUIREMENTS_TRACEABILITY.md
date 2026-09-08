# Phase 1 — Requirements Traceability

هذه المصفوفة تربط متطلبات FAMILY الأساسية بمواقع التنفيذ الحالية وبالمرحلة التي ستكمل الفجوة. وهي ليست بديلًا عن `FAMILY_MANUS_INSTRUCTIONS.pdf`، بل عقد متابعة داخلي.

| مجموعة المتطلبات | التنفيذ الحالي | الحالة بعد Phase 1 | المرحلة التالية |
|---|---|---|---|
| Multi-user وOwner separation | `users`, `workspaces`, `memberships`, `financialProfiles`, `platformOwnership`, `familyAccess.ts` | موثق بعقد صلاحيات موحد | Phase 2 |
| EGP وMulti-Currency | `workspaces.baseCurrency`, حقول currency، `fxRates`, `ledgerMath` | مصدر الحقيقة محدد | Phase 3/4 |
| Accounts وTransactions وLedger | `accounts`, `financialEvents`, `journalEntries`, `journalLines`, `familyLedger.ts` | Ledger Fact محدد | Phase 2/3 |
| Taxes وFees | `fee_tax_rules`, `suggestTradeCharges`, حقول الرسوم والضرائب | مشتق/اقتراح لا Ledger Fact مستقل | Phase 5 |
| Investments وHoldings | `instruments`, `positions`, `listPortfolioPositions` | Projection محدد | Phase 4/5 |
| Lots وRealized P&L | لا يوجد نموذج Lots مكتمل | فجوة معلنة | Phase 5 |
| Market Data وWatchlist | `marketData.ts`, `marketRefresh.ts`, `priceQuotes`, `watchlistItems` | External Market Data محدد | Phase 4 |
| Alerts وNotifications | `PriorityAlerts`, `marketEmail`, حالات delivery | Operational Metadata محدد | Phase 8 |
| Cash Flow وBudget | `getCashFlowSummary`, `budgets`, `recurringRules` | Projection محدد | Phase 3/6 |
| Debt وEmergency Fund | `debts`, `debtPayments`, `emergencyFundPlans`, المحركات الحسابية | Projection محدد | Phase 3/6 |
| Goals وRetirement وFI | `financialGoals`, `retirementPlans`, سيناريوهات | Goals/Retirement موجودان وFI يحتاج محركًا | Phase 6 |
| Risk وAllocation وRebalancing | `riskProfiles`, `allocationTargets`, `calculateAllocation`، صفحات المخاطر | Projection/Review محدد | Phase 6 |
| Insurance وReal Estate وGold | جداول التأمين، `specialAssets`, `goldQuoteMath` | نماذج أساسية؛ المتخصص يحتاج توسعة | Phase 7 |
| Net Worth وHealth Score | Net Worth في `familyRead.ts`؛ Health Score غير موجود | Net Worth Projection؛ Health Score فجوة | Phase 3/6 |
| Scenarios وAI Advisor | `planningScenarios` ومحركات الإسقاط؛ لا Advisor مالي مقيد | Scenario Projection؛ AI مؤجل | Phase 6/12 |
| Command Center وReports | `FintechDashboard.tsx`, `ReportsPage`, `FamilyExportPage` | واجهة قراءة موثقة | Phase 9 |
| Audit وSecurity | `audit_events`, `platform_audit_events`, OAuth، أدوار وموافقات | Operational Metadata وسياسات موثقة | Phase 2/11 |
| UX/UI وPWA وRTL | `App.tsx`, `DashboardLayout`, providers، صفحات FAMILY | Presentation Layer محدد | Phase 9 |

## قاعدة تغيير الوثيقة

لا تُعدّل هذه المصفوفة عند إضافة واجهة فقط إذا لم يتغير عقد البيانات أو مصدر الحقيقة. أي تغيير في Ledger أو صلاحيات النشر أو قاعدة التقييم يجب أن يحدّث هذا الملف ويضيف اختبارًا مناسبًا.
