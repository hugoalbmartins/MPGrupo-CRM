import React from 'react';
import { Zap, Flame, Layers } from 'lucide-react';
import { Card, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import { motion } from 'framer-motion';

const EnergyTypeStep = ({ onSelect, availableTypes }) => {
  const types = [
    {
      value: 'eletricidade',
      label: 'Eletricidade',
      description: 'Simule apenas eletricidade',
      icon: Zap,
      color: 'from-yellow-500 to-orange-500',
      available: availableTypes.includes('eletricidade')
    },
    {
      value: 'gas',
      label: 'Gás Natural',
      description: 'Simule apenas gás natural',
      icon: Flame,
      color: 'from-blue-500 to-cyan-500',
      available: availableTypes.includes('gas')
    },
    {
      value: 'dual',
      label: 'Dual (Eletricidade + Gás)',
      description: 'Simule ambos os serviços',
      icon: Layers,
      color: 'from-purple-500 to-pink-500',
      available: availableTypes.includes('dual')
    }
  ];

  return (
    <div className="max-w-4xl mx-auto">
      <div className="text-center mb-8">
        <h2 className="text-3xl font-bold text-white mb-3">
          Que tipo de energia deseja simular?
        </h2>
        <p className="text-dark-300 text-lg">
          Escolha o tipo de serviço para começar a sua simulação
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {types.filter(type => type.available).map((type, index) => {
          const Icon = type.icon;
          return (
            <motion.div
              key={type.value}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
            >
              <Card
                className="relative overflow-hidden cursor-pointer group hover:shadow-xl transition-all duration-300 border-white/10 bg-dark-800/50 backdrop-blur-sm"
                onClick={() => onSelect(type.value)}
              >
                <div className={`absolute inset-0 bg-gradient-to-br ${type.color} opacity-0 group-hover:opacity-10 transition-opacity duration-300`} />
                <CardContent className="p-6">
                  <div className="flex flex-col items-center text-center space-y-4">
                    <div className={`p-4 rounded-2xl bg-gradient-to-br ${type.color} shadow-lg`}>
                      <Icon className="w-8 h-8 text-white" />
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-white mb-2">
                        {type.label}
                      </h3>
                      <p className="text-dark-300 text-sm">
                        {type.description}
                      </p>
                    </div>
                    <Button
                      className="w-full bg-gold-400 hover:bg-gold-500 text-dark-900 font-semibold"
                    >
                      Selecionar
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </div>

      {availableTypes.length === 0 && (
        <div className="text-center py-12">
          <p className="text-dark-400 text-lg">
            Nenhuma operadora disponível no momento. Por favor, tente mais tarde.
          </p>
        </div>
      )}
    </div>
  );
};

export default EnergyTypeStep;
