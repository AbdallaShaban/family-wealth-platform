import React from "react";
import DashboardLayout from "@/components/DashboardLayout";
import PageHeader from "@/components/PageHeader";
import { Landmark } from "lucide-react";
import BankCertificatesHub from "@/components/banking/BankCertificatesHub";

export function CertificatesPage() {
  return (
    <DashboardLayout>
      <div dir="rtl" className="mx-auto max-w-6xl space-y-6">
        <PageHeader
          title="الشهادات البنكية والودائع لأجل"
          description="إدارة ومتابعة أصول الشهادات ذات العائد الثابت، جدول مواعيد الاستحقاق، وتحصيل العائد الدوري بنقرة واحدة."
          breadcrumbs={[
            { label: "النقد والالتزامات", href: "/accounts" },
            { label: "الشهادات والودائع البنكية" },
          ]}
          badge={{ text: "عائد ثابت دوري", variant: "institutional" }}
          icon={Landmark}
        />

        <BankCertificatesHub />
      </div>
    </DashboardLayout>
  );
}

export default CertificatesPage;
