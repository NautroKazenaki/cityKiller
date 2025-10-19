import React, { useState } from 'react';
import './App.css';
import citizensData from './data/citizens.json';
import { assignGroupsToCitizens } from './utils/citizenUtils';
import { generateBuildings, placeCitizensOnMap, createDistricts, updateDistrictsWithBuildings } from './utils/gameUtils';
import type { Citizen } from './types/citizen';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { RealGameBoard } from '@/components/game/RealGameBoard';
import { CitizenCard } from '@/components/game/CitizenCard';

function App() {
  const citizensWithGroups = assignGroupsToCitizens(citizensData.citizens as Citizen[]);
  const [gameState, setGameState] = useState<'menu' | 'game'>('menu');
  const [selectedDistrict, setSelectedDistrict] = useState<{x: number, y: number} | undefined>();
  
  // Генерируем игровые данные
  const buildings = generateBuildings();
  const citizenPositions = placeCitizensOnMap(citizensWithGroups);
  let districts = createDistricts(citizenPositions);
  districts = updateDistrictsWithBuildings(districts, buildings);
  
  // Позиция детектива (пока статичная)
  const detectivePosition = { x: 1, y: 1 };

  const handleStartGame = () => {
    setGameState('game');
  };

  const handleDistrictClick = (x: number, y: number) => {
    setSelectedDistrict({ x, y });
  };

  if (gameState === 'menu') {
    return (
      <div className="min-h-screen bg-background">
        <header className="border-b">
          <div className="container mx-auto px-4 py-6">
            <h1 className="text-4xl font-bold text-center">City Killer</h1>
            <p className="text-center text-muted-foreground mt-2">
              Настольная игра про детектива и убийцу
            </p>
          </div>
        </header>
        
        <main className="container mx-auto px-4 py-8">
          <div className="grid gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Отладочная информация</CardTitle>
                <CardDescription>
                  Статистика по гражданам и их группам
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <p className="text-lg">
                    Всего граждан: <span className="font-semibold">{citizensWithGroups.length}</span>
                  </p>
                  
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {Object.entries(
                      citizensWithGroups.reduce((acc, citizen) => {
                        acc[citizen.group || 'unknown'] = (acc[citizen.group || 'unknown'] || 0) + 1;
                        return acc;
                      }, {} as Record<string, number>)
                    ).map(([group, count]) => (
                      <Card key={group} className="p-4">
                        <div className="text-center">
                          <div className="text-2xl font-bold text-primary">{count}</div>
                          <div className="text-sm text-muted-foreground capitalize">{group}</div>
                        </div>
                      </Card>
                    ))}
                  </div>
                  
                  <div className="flex gap-4 pt-4">
                    <Button onClick={handleStartGame}>Начать новую игру</Button>
                    <Button variant="outline">Присоединиться к игре</Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">City Killer</h1>
              <p className="text-sm text-muted-foreground">Игровая доска</p>
            </div>
            <Button variant="outline" onClick={() => setGameState('menu')}>
              Вернуться в меню
            </Button>
          </div>
        </div>
      </header>
      
      <main className="container mx-auto px-4 py-8">
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Игровая доска */}
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle>Игровая доска 4x4</CardTitle>
                <CardDescription>
                  Кликните на район для выбора
                </CardDescription>
              </CardHeader>
              <CardContent>
                <RealGameBoard
                  districts={districts}
                  buildings={buildings}
                  onDistrictClick={handleDistrictClick}
                  selectedDistrict={selectedDistrict}
                  detectivePosition={detectivePosition}
                />
              </CardContent>
            </Card>
          </div>
          
          {/* Информационная панель */}
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Выбранный район</CardTitle>
              </CardHeader>
              <CardContent>
                {selectedDistrict ? (
                  <div className="space-y-2">
                    <p>Координаты: {selectedDistrict.x}, {selectedDistrict.y}</p>
                    <p>Граждан: {districts[selectedDistrict.y][selectedDistrict.x].citizens.length}</p>
                    <p>Зданий: {districts[selectedDistrict.y][selectedDistrict.x].buildings.length}</p>
                  </div>
                ) : (
                  <p className="text-muted-foreground">Выберите район на карте</p>
                )}
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle>Граждане в районе</CardTitle>
              </CardHeader>
              <CardContent>
                {selectedDistrict ? (
                  <div className="space-y-2">
                    {districts[selectedDistrict.y][selectedDistrict.x].citizens.map((citizenPos) => {
                      const citizen = citizensWithGroups.find(c => c.id === citizenPos.citizenId);
                      return citizen ? (
                        <CitizenCard
                          key={citizenPos.citizenId}
                          citizen={citizen}
                          isScared={citizenPos.isScared}
                          isDead={citizenPos.isDead}
                          showDetails={true}
                        />
                      ) : null;
                    })}
                  </div>
                ) : (
                  <p className="text-muted-foreground">Выберите район для просмотра граждан</p>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}

export default App;
