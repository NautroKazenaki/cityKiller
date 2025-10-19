import React from 'react';
import { cn } from '@/lib/utils';
import type { District, Building } from '@/types/game';
import BoardImage from '@/assets/Board.jpg';

interface RealGameBoardProps {
  districts: District[][];
  buildings: Building[];
  onDistrictClick?: (x: number, y: number) => void;
  selectedDistrict?: { x: number; y: number };
  detectivePosition?: { x: number; y: number };
}

export function RealGameBoard({
  districts,
  buildings,
  onDistrictClick,
  selectedDistrict,
  detectivePosition
}: RealGameBoardProps) {
  return (
    <div className="w-full max-w-4xl mx-auto">
      <div className="relative">
        {/* Фоновое изображение игрового поля */}
        <img 
          src={BoardImage} 
          alt="Игровое поле" 
          className="w-full h-auto rounded-lg shadow-lg"
          style={{ aspectRatio: '1/1' }}
        />
        
        {/* Интерактивные зоны поверх изображения */}
        <div className="absolute inset-0 grid grid-cols-4 gap-0">
          {districts.map((row, y) =>
            row.map((district, x) => (
              <DistrictOverlay
                key={`${x}-${y}`}
                district={district}
                x={x}
                y={y}
                buildings={buildings.filter(b => b.districtX === x && b.districtY === y)}
                onClick={() => onDistrictClick?.(x, y)}
                isSelected={selectedDistrict?.x === x && selectedDistrict?.y === y}
                hasDetective={detectivePosition?.x === x && detectivePosition?.y === y}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
}

interface DistrictOverlayProps {
  district: District;
  x: number;
  y: number;
  buildings: Building[];
  onClick?: () => void;
  isSelected: boolean;
  hasDetective: boolean;
}

function DistrictOverlay({
  district,
  x,
  y,
  buildings,
  onClick,
  isSelected,
  hasDetective
}: DistrictOverlayProps) {
  return (
    <div
      className={cn(
        "relative cursor-pointer transition-all duration-200 hover:bg-blue-500/10",
        isSelected && "bg-blue-500/20 ring-2 ring-blue-500",
        hasDetective && "bg-blue-600/20"
      )}
      onClick={onClick}
      style={{ aspectRatio: '1/1' }}
    >
      {/* Детектив */}
      {hasDetective && (
        <div className="absolute top-2 right-2 z-10">
          <div className="bg-blue-600 text-white px-2 py-1 rounded-full text-xs font-bold shadow-lg">
            🚔
          </div>
        </div>
      )}
      
      {/* Здания */}
      <div className="absolute top-2 left-2 flex gap-1 z-10">
        {buildings.map((building) => (
          <div
            key={building.id}
            className={cn(
              "w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shadow-lg",
              building.type === 'police' && "bg-blue-600 text-white",
              building.type === 'hospital' && "bg-red-600 text-white",
              building.type === 'fire' && "bg-orange-600 text-white",
              building.type === 'diner' && "bg-yellow-600 text-white"
            )}
            title={building.type}
          >
            {building.type === 'police' && '🚔'}
            {building.type === 'hospital' && '🏥'}
            {building.type === 'fire' && '🚒'}
            {building.type === 'diner' && '🍽️'}
          </div>
        ))}
      </div>
      
      {/* Граждане */}
      <div className="absolute bottom-2 left-2 flex gap-1 z-10">
        {district.citizens.slice(0, 3).map((citizen, index) => (
          <div
            key={citizen.citizenId}
            className={cn(
              "w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shadow-lg border-2",
              citizen.isScared && "bg-red-500 text-white border-red-700",
              citizen.isDead && "bg-gray-500 text-white border-gray-700",
              !citizen.isScared && !citizen.isDead && "bg-green-500 text-white border-green-700"
            )}
            title={`Гражданин ID: ${citizen.citizenId}`}
          >
            {citizen.isDead ? '💀' : citizen.isScared ? '😰' : '👤'}
          </div>
        ))}
        
        {/* Показать количество если больше 3 */}
        {district.citizens.length > 3 && (
          <div className="w-8 h-8 rounded-full bg-gray-800 text-white flex items-center justify-center text-xs font-bold shadow-lg border-2 border-gray-600">
            +{district.citizens.length - 3}
          </div>
        )}
      </div>
      
      {/* Координаты для отладки */}
      <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-xs text-white bg-black/50 px-1 rounded opacity-0 hover:opacity-100 transition-opacity">
        {x},{y}
      </div>
    </div>
  );
}
