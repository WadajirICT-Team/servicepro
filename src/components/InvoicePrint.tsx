import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Printer } from "lucide-react";
import { Separator } from "@/components/ui/separator";

interface InvoicePrintProps {
  ticket: any;
  parts: any[];
  partsTotal: number;
  onBack: () => void;
}

interface BusinessInfo {
  company_name: string;
  company_phone: string;
  company_email: string;
  company_address: string;
  currency_symbol: string;
  tax_rate: number;
}

export default function InvoicePrint({ ticket, parts, partsTotal, onBack }: InvoicePrintProps) {
  const [biz, setBiz] = useState<BusinessInfo>({
    company_name: "",
    company_phone: "",
    company_email: "",
    company_address: "",
    currency_symbol: "$",
    tax_rate: 0,
  });

  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase.from("business_settings").select("*").limit(1).single();
      if (data) {
        setBiz({
          company_name: data.company_name || "",
          company_phone: data.company_phone || "",
          company_email: data.company_email || "",
          company_address: data.company_address || "",
          currency_symbol: data.currency_symbol || "$",
          tax_rate: Number(data.tax_rate) || 0,
        });
      }
    };
    fetch();
  }, []);

  const cur = biz.currency_symbol;
  const laborCost = Number(ticket.labor_cost || 0);
  const subtotal = laborCost + partsTotal;
  const taxAmount = biz.tax_rate > 0 ? subtotal * (biz.tax_rate / 100) : 0;
  const totalCost = subtotal + taxAmount;

  const handlePrint = () => {
    window.print();
  };

  return (
    <div>
      {/* Screen-only controls */}
      <div className="flex items-center gap-3 mb-6 print:hidden">
        <Button variant="ghost" size="icon" onClick={onBack}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-2xl font-bold flex-1">Invoice Preview</h1>
        <Button onClick={handlePrint}>
          <Printer className="h-4 w-4 mr-2" /> Print Invoice
        </Button>
      </div>

      {/* Printable invoice */}
      <div className="max-w-2xl mx-auto bg-background border rounded-lg p-8 print:border-none print:shadow-none print:p-0 print:max-w-none">
        {/* Header */}
        <div className="flex justify-between items-start mb-8">
          <div>
            {biz.company_name ? (
              <>
                <h2 className="text-2xl font-bold text-foreground">{biz.company_name}</h2>
                {biz.company_phone && <p className="text-sm text-muted-foreground">{biz.company_phone}</p>}
                {biz.company_email && <p className="text-sm text-muted-foreground">{biz.company_email}</p>}
                {biz.company_address && <p className="text-sm text-muted-foreground whitespace-pre-line">{biz.company_address}</p>}
              </>
            ) : (
              <h2 className="text-2xl font-bold text-foreground">INVOICE</h2>
            )}
          </div>
          <div className="text-right text-sm text-muted-foreground">
            {biz.company_name && <p className="font-semibold text-foreground text-lg mb-1">INVOICE</p>}
            <p>Ticket #{ticket.ticket_number}</p>
            <p>Date: {new Date(ticket.updated_at).toLocaleDateString()}</p>
            <p>Status: <span className="capitalize">{ticket.status?.replace(/_/g, " ")}</span></p>
          </div>
        </div>

        <Separator className="mb-6" />

        {/* Customer */}
        <div className="grid grid-cols-2 gap-8 mb-8">
          <div>
            <h3 className="text-xs font-semibold text-muted-foreground uppercase mb-2">Bill To</h3>
            {ticket.customers ? (
              <div className="text-sm space-y-0.5">
                <p className="font-medium">{ticket.customers.full_name}</p>
                <p>{ticket.customers.phone}</p>
                {ticket.customers.email && <p>{ticket.customers.email}</p>}
                {ticket.customers.address && <p>{ticket.customers.address}</p>}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No customer info</p>
            )}
          </div>
          <div>
            <h3 className="text-xs font-semibold text-muted-foreground uppercase mb-2">Service Details</h3>
            <div className="text-sm space-y-0.5">
              <p><span className="text-muted-foreground">Appliance:</span> {ticket.appliance_type?.replace(/_/g, " ")}{ticket.appliance_brand ? ` — ${ticket.appliance_brand}` : ""}{ticket.appliance_model ? ` ${ticket.appliance_model}` : ""}</p>
              <p><span className="text-muted-foreground">Issue:</span> {ticket.issue_description}</p>
              {ticket.diagnosis && <p><span className="text-muted-foreground">Diagnosis:</span> {ticket.diagnosis}</p>}
            </div>
          </div>
        </div>

        {/* Parts table */}
        {parts.length > 0 && (
          <div className="mb-6">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase mb-3">Parts & Materials</h3>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 font-medium">Part</th>
                  <th className="text-center py-2 font-medium">Qty</th>
                  <th className="text-right py-2 font-medium">Unit Cost</th>
                  <th className="text-right py-2 font-medium">Total</th>
                </tr>
              </thead>
              <tbody>
                {parts.map((p) => (
                  <tr key={p.id} className="border-b border-muted">
                    <td className="py-2">{p.part_name}</td>
                    <td className="py-2 text-center">{p.quantity}</td>
                    <td className="py-2 text-right">{cur}{Number(p.unit_cost).toFixed(2)}</td>
                    <td className="py-2 text-right">{cur}{Number(p.total_cost).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Totals */}
        <div className="ml-auto max-w-xs space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Parts Subtotal</span>
            <span>{cur}{partsTotal.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Labor</span>
            <span>{cur}{laborCost.toFixed(2)}</span>
          </div>
          {biz.tax_rate > 0 && (
            <>
              <Separator />
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Subtotal</span>
                <span>{cur}{subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Tax ({biz.tax_rate}%)</span>
                <span>{cur}{taxAmount.toFixed(2)}</span>
              </div>
            </>
          )}
          <Separator />
          <div className="flex justify-between font-bold text-lg">
            <span>Total</span>
            <span>{cur}{totalCost.toFixed(2)}</span>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-12 pt-6 border-t text-center text-xs text-muted-foreground">
          <p>Thank you for your business!</p>
        </div>
      </div>
    </div>
  );
}
