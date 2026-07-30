import { useState, useEffect } from "react";
import { Calculator } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useApp } from "@/lib/app-state";
import { BondCalculator } from "./bond-calculator";
import { TransferCalculator } from "./transfer-calculator";
import { AffordabilityCalculator } from "./affordability-calculator";
import { YieldCalculator } from "./yield-calculator";
import { CommissionCalculator } from "./commission-calculator";

export function CalculatorModal() {
  const { calculatorOpen, calculatorContext, toggleCalculator } = useApp();
  const [activeTab, setActiveTab] = useState("bond");

  useEffect(() => {
    if (calculatorOpen && calculatorContext?.tab) {
      setActiveTab(calculatorContext.tab);
    }
  }, [calculatorOpen, calculatorContext]);

  return (
    <Dialog open={calculatorOpen} onOpenChange={toggleCalculator}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto sm:max-h-[85vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calculator className="size-5" />
            Calculators
          </DialogTitle>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-4">
          <TabsList className="grid w-full grid-cols-2 lg:grid-cols-5 h-auto lg:h-10">
            <TabsTrigger value="bond">Bond Repayment</TabsTrigger>
            <TabsTrigger value="transfer">Transfer Cost</TabsTrigger>
            <TabsTrigger value="affordability">Affordability</TabsTrigger>
            <TabsTrigger value="yield">Rental Yield</TabsTrigger>
            <TabsTrigger value="commission">Commission</TabsTrigger>
          </TabsList>

          <div className="mt-6">
            <TabsContent value="bond" className="mt-0">
              <BondCalculator />
            </TabsContent>

            <TabsContent value="transfer" className="mt-0">
              <TransferCalculator />
            </TabsContent>

            <TabsContent value="affordability" className="mt-0">
              <AffordabilityCalculator />
            </TabsContent>

            <TabsContent value="yield" className="mt-0">
              <YieldCalculator />
            </TabsContent>

            <TabsContent value="commission" className="mt-0">
              <CommissionCalculator />
            </TabsContent>
          </div>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
