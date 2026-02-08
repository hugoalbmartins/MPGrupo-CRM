import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Zap, Flame, BarChart3, Loader2 } from 'lucide-react';
import EnergyTypeStep from '../components/energy-simulator/EnergyTypeStep';
import ElectricityFormStep from '../components/energy-simulator/ElectricityFormStep';
import GasFormStep from '../components/energy-simulator/GasFormStep';
import ResultsStep from '../components/energy-simulator/ResultsStep';
import { energySimulatorService } from '../services/energySimulatorService';
import { toast } from 'sonner';

const INITIAL_ELECTRICITY_DATA = {
  operadora_atual: '',
  potencia: '',
  valor_potencia_dia: '',
  dias: '30',
  ciclo: '',
  consumos: {
    energia: '',
    vazio: '',
    fora_vazio: '',
    cheia: '',
    ponta: ''
  },
  precos: {
    energia: '',
    vazio: '',
    fora_vazio: '',
    cheia: '',
    ponta: ''
  },
  tem_debito_direto: false,
  tem_fatura_eletronica: false
};

const INITIAL_GAS_DATA = {
  escalao: '',
  dias: '30',
  valor_diario: '',
  consumo_kwh: '',
  preco_kwh: ''
};

const EnergySimulatorNew = () => {
  const [step, setStep] = useState(0);
  const [tipoEnergia, setTipoEnergia] = useState(null);
  const [availableTypes, setAvailableTypes] = useState([]);
  const [eletricidadeData, setEletricidadeData] = useState(INITIAL_ELECTRICITY_DATA);
  const [gasData, setGasData] = useState(INITIAL_GAS_DATA);
  const [simulationResults, setSimulationResults] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    checkAvailableTypes();
  }, []);

  const checkAvailableTypes = async () => {
    try {
      const operadoras = await energySimulatorService.getActiveOperators();

      const hasEletricidade = operadoras.some(op => op.tipos_energia?.includes('eletricidade'));
      const hasGas = operadoras.some(op => op.tipos_energia?.includes('gas'));
      const hasDual = operadoras.some(op =>
        op.tipos_energia?.includes('eletricidade') && op.tipos_energia?.includes('gas')
      );

      const types = [];
      if (hasEletricidade) types.push('eletricidade');
      if (hasGas) types.push('gas');
      if (hasDual) types.push('dual');

      setAvailableTypes(types);

      if (types.length === 1) {
        setTipoEnergia(types[0]);
        setStep(1);
      }
    } catch (error) {
      console.error('Error checking available types:', error);
      toast.error('Erro ao carregar operadoras disponíveis');
    }
  };

  const handleEnergyTypeSelect = (type) => {
    setTipoEnergia(type);
    setStep(1);
  };

  const handleElectricityNext = () => {
    if (tipoEnergia === 'eletricidade') {
      handleSimulate();
    } else {
      setStep(2);
    }
  };

  const handleGasNext = () => {
    handleSimulate();
  };

  const handleSimulate = async () => {
    setLoading(true);
    try {
      const formData = {
        tipo_energia: tipoEnergia,
        operadora_atual: eletricidadeData.operadora_atual,
        tem_debito_direto: eletricidadeData.tem_debito_direto,
        tem_fatura_eletronica: eletricidadeData.tem_fatura_eletronica
      };

      if (tipoEnergia === 'eletricidade' || tipoEnergia === 'dual') {
        formData.eletricidade = {
          potencia: eletricidadeData.potencia,
          valor_potencia_dia: eletricidadeData.valor_potencia_dia,
          dias: eletricidadeData.dias,
          ciclo: eletricidadeData.ciclo,
          consumos: eletricidadeData.consumos,
          precos: eletricidadeData.precos
        };
      }

      if (tipoEnergia === 'gas' || tipoEnergia === 'dual') {
        formData.gas = {
          escalao: gasData.escalao,
          dias: gasData.dias || eletricidadeData.dias,
          valor_diario: gasData.valor_diario,
          consumo_kwh: gasData.consumo_kwh,
          preco_kwh: gasData.preco_kwh
        };
      }

      const results = await energySimulatorService.simularComparacoes(formData);

      setSimulationResults({
        ...results,
        formData
      });
      setStep(3);
    } catch (error) {
      console.error('Error simulating:', error);
      toast.error('Erro ao calcular simulação. Por favor, verifique os dados inseridos.');
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    if (step === 3) {
      if (tipoEnergia === 'eletricidade') {
        setStep(1);
      } else if (tipoEnergia === 'gas') {
        setStep(2);
      } else {
        setStep(2);
      }
    } else if (step === 2) {
      setStep(1);
    } else if (step === 1) {
      if (availableTypes.length > 1) {
        setStep(0);
        setTipoEnergia(null);
      }
    }
  };

  const handleNewSimulation = () => {
    setStep(0);
    setTipoEnergia(null);
    setEletricidadeData(INITIAL_ELECTRICITY_DATA);
    setGasData(INITIAL_GAS_DATA);
    setSimulationResults(null);
  };

  const steps = [
    { label: 'Tipo de Energia', icon: Zap },
    { label: 'Eletricidade', icon: Zap },
    { label: 'Gás', icon: Flame },
    { label: 'Resultados', icon: BarChart3 }
  ];

  const getActiveSteps = () => {
    const activeSteps = [];
    if (availableTypes.length > 1) {
      activeSteps.push(steps[0]);
    }
    if (tipoEnergia === 'eletricidade' || tipoEnergia === 'dual') {
      activeSteps.push(steps[1]);
    }
    if (tipoEnergia === 'gas' || tipoEnergia === 'dual') {
      activeSteps.push(steps[2]);
    }
    activeSteps.push(steps[3]);
    return activeSteps;
  };

  const activeSteps = getActiveSteps();
  const currentStepIndex = step === 0 ? 0 : step === 1 ? (availableTypes.length > 1 ? 1 : 0) : step === 2 ? (availableTypes.length > 1 ? 2 : 1) : activeSteps.length - 1;

  return (
    <div className="min-h-screen pb-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">
            Simulador de Energia
          </h1>
          <p className="text-dark-300 text-lg">
            Compare operadoras e descubra quanto pode poupar
          </p>
        </div>

        {step !== 3 && (
          <div className="mb-8">
            <div className="flex items-center justify-center gap-2">
              {activeSteps.map((stepItem, index) => {
                const StepIcon = stepItem.icon;
                const isActive = index === currentStepIndex;
                const isCompleted = index < currentStepIndex;

                return (
                  <React.Fragment key={index}>
                    <div className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all ${
                      isActive ? 'bg-gold-400 text-dark-900' : isCompleted ? 'bg-green-500/20 text-green-400' : 'bg-dark-700/50 text-dark-400'
                    }`}>
                      <StepIcon className="w-5 h-5" />
                      <span className="font-medium hidden md:inline">{stepItem.label}</span>
                    </div>
                    {index < activeSteps.length - 1 && (
                      <div className={`h-0.5 w-8 md:w-16 transition-colors ${isCompleted ? 'bg-green-500' : 'bg-dark-700'}`} />
                    )}
                  </React.Fragment>
                );
              })}
            </div>
          </div>
        )}

        {loading && (
          <div className="flex flex-col items-center justify-center py-20">
            <Loader2 className="w-12 h-12 text-gold-400 animate-spin mb-4" />
            <p className="text-white text-lg">A calcular a melhor opção para si...</p>
          </div>
        )}

        {!loading && (
          <>
            {step === 0 && (
              <EnergyTypeStep
                onSelect={handleEnergyTypeSelect}
                availableTypes={availableTypes}
              />
            )}

            {step === 1 && (tipoEnergia === 'eletricidade' || tipoEnergia === 'dual') && (
              <ElectricityFormStep
                formData={eletricidadeData}
                onChange={setEletricidadeData}
                onNext={handleElectricityNext}
                onBack={handleBack}
                tipoEnergia={tipoEnergia}
              />
            )}

            {step === 2 && (tipoEnergia === 'gas' || tipoEnergia === 'dual') && (
              <GasFormStep
                formData={gasData}
                onChange={setGasData}
                onNext={handleGasNext}
                onBack={handleBack}
                eletricidadeData={eletricidadeData}
              />
            )}

            {step === 3 && simulationResults && (
              <ResultsStep
                simulationData={simulationResults}
                onBack={handleBack}
                onNewSimulation={handleNewSimulation}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default EnergySimulatorNew;
