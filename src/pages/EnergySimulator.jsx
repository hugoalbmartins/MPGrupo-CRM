import React, { useState, useEffect } from 'react';
import { Loader2, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { simulatorService } from '../services/simulatorService';
import SimulatorForm from '../components/simulator/SimulatorForm';
import SimulatorResults from '../components/simulator/SimulatorResults';

const EnergySimulator = ({ user }) => {
  const [operators, setOperators] = useState([]);
  const [settings, setSettings] = useState({});
  const [electricityPlans, setElectricityPlans] = useState([]);
  const [gasPlans, setGasPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [simulating, setSimulating] = useState(false);
  const [results, setResults] = useState(null);

  const [formData, setFormData] = useState({
    energyType: '',
    operatorId: '',
    power: '',
    tariffType: '',
    consumption: {
      vazio: '',
      fora_vazio: '',
      ponta: '',
      cheia: ''
    },
    currentBill: '',
    gasConsumption: '',
    currentGasBill: ''
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [ops, setts, elecPlans, gPlans] = await Promise.all([
        simulatorService.getOperators(),
        simulatorService.getSettings(),
        simulatorService.getElectricityPlans(),
        simulatorService.getGasPlans()
      ]);

      setOperators(ops);
      setSettings(setts);
      setElectricityPlans(elecPlans);
      setGasPlans(gPlans);
    } catch (error) {
      console.error('Failed to load simulator data:', error);
      toast.error('Erro ao carregar dados do simulador');
    } finally {
      setLoading(false);
    }
  };

  const handleSimulate = async () => {
    try {
      setSimulating(true);

      const { energyType, power, tariffType, consumption, currentBill, gasConsumption, currentGasBill } = formData;

      let plans = [];

      if (energyType === 'eletricidade') {
        const filteredPlans = electricityPlans.filter(p =>
          p.tariff_type === tariffType
        );

        const currentCost = parseFloat(currentBill) || simulatorService.calculateElectricityCost(consumption, tariffType, settings);

        plans = filteredPlans.map(plan => {
          const monthlyCost = simulatorService.calculateElectricityPlanCost(plan, consumption, power);
          const savings = currentCost - monthlyCost;

          return {
            operatorName: plan.simulator_operators?.name || 'Desconhecido',
            planName: plan.name,
            monthlyCost,
            savings,
            discount: plan.discount_percentage || 0,
            electricityCost: monthlyCost
          };
        });

        if (plans.length === 0) {
          const erseCost = simulatorService.calculateElectricityCost(consumption, tariffType, settings);
          plans.push({
            operatorName: 'ERSE',
            planName: 'Preco Regulado',
            monthlyCost: erseCost,
            savings: currentCost - erseCost,
            discount: 0,
            electricityCost: erseCost
          });
        }

      } else if (energyType === 'gas') {
        const filteredPlans = gasPlans;

        const currentCost = parseFloat(currentGasBill) || simulatorService.calculateGasCost(gasConsumption, settings);

        plans = filteredPlans.map(plan => {
          const monthlyCost = simulatorService.calculateGasPlanCost(plan, gasConsumption);
          const savings = currentCost - monthlyCost;

          return {
            operatorName: plan.simulator_operators?.name || 'Desconhecido',
            planName: plan.name,
            monthlyCost,
            savings,
            discount: plan.discount_percentage || 0,
            gasCost: monthlyCost
          };
        });

        if (plans.length === 0) {
          const erseCost = simulatorService.calculateGasCost(gasConsumption, settings);
          plans.push({
            operatorName: 'ERSE',
            planName: 'Preco Regulado Gas',
            monthlyCost: erseCost,
            savings: currentCost - erseCost,
            discount: 0,
            gasCost: erseCost
          });
        }

      } else if (energyType === 'dual') {
        const filteredElecPlans = electricityPlans.filter(p =>
          p.tariff_type === tariffType
        );
        const filteredGasPlans = gasPlans;

        const currentElecCost = parseFloat(currentBill) || simulatorService.calculateElectricityCost(consumption, tariffType, settings);
        const currentGasCost = parseFloat(currentGasBill) || simulatorService.calculateGasCost(gasConsumption, settings);
        const currentTotalCost = currentElecCost + currentGasCost;

        filteredElecPlans.forEach(elecPlan => {
          filteredGasPlans.forEach(gasPlan => {
            if (elecPlan.operator_id === gasPlan.operator_id) {
              const elecCost = simulatorService.calculateElectricityPlanCost(elecPlan, consumption, power);
              const gasCost = simulatorService.calculateGasPlanCost(gasPlan, gasConsumption);
              const monthlyCost = elecCost + gasCost;
              const savings = currentTotalCost - monthlyCost;

              plans.push({
                operatorName: elecPlan.simulator_operators?.name || 'Desconhecido',
                planName: `${elecPlan.name} + ${gasPlan.name}`,
                monthlyCost,
                savings,
                discount: Math.max(elecPlan.discount_percentage || 0, gasPlan.discount_percentage || 0),
                electricityCost: elecCost,
                gasCost: gasCost
              });
            }
          });
        });

        if (plans.length === 0) {
          const erseElecCost = simulatorService.calculateElectricityCost(consumption, tariffType, settings);
          const erseGasCost = simulatorService.calculateGasCost(gasConsumption, settings);
          const erseTotalCost = erseElecCost + erseGasCost;

          plans.push({
            operatorName: 'ERSE',
            planName: 'Preco Regulado Dual',
            monthlyCost: erseTotalCost,
            savings: currentTotalCost - erseTotalCost,
            discount: 0,
            electricityCost: erseElecCost,
            gasCost: erseGasCost
          });
        }
      }

      plans.sort((a, b) => b.savings - a.savings);

      const bestSavings = plans.length > 0 && plans[0].savings > 0 ? plans[0].savings : 0;

      setResults({
        plans,
        bestSavings
      });

      toast.success('Simulacao concluida com sucesso!');
    } catch (error) {
      console.error('Simulation error:', error);
      toast.error('Erro ao realizar simulacao');
    } finally {
      setSimulating(false);
    }
  };

  const handleReset = () => {
    setResults(null);
    setFormData({
      energyType: '',
      operatorId: '',
      power: '',
      tariffType: '',
      consumption: {
        vazio: '',
        fora_vazio: '',
        ponta: '',
        cheia: ''
      },
      currentBill: '',
      gasConsumption: '',
      currentGasBill: ''
    });
  };

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-3 text-blue-600" />
          <p className="text-sm text-dark-300">Carregando simulador...</p>
        </div>
      </div>
    );
  }

  if (simulating) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-3 text-blue-600" />
          <p className="text-sm text-dark-300">Simulando planos...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white mb-1">Simulador de Poupanca Energetica</h1>
          <p className="text-sm text-dark-400">
            Compare planos e encontre a melhor opcao para os seus clientes
          </p>
        </div>
        {results && (
          <button onClick={handleReset} className="btn-outline text-sm">
            Nova Simulacao
          </button>
        )}
      </div>

      {!results ? (
        <SimulatorForm
          formData={formData}
          setFormData={setFormData}
          operators={operators}
          onSubmit={handleSimulate}
        />
      ) : (
        <SimulatorResults
          results={results}
          formData={formData}
          user={user}
        />
      )}
    </div>
  );
};

export default EnergySimulator;
