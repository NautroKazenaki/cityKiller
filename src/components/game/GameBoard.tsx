import React from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { District, Building } from '@/types/game';

interface GameBoardProps {
  districts: District[][];
  buildings: Building[];
  onDistrictClick?: (x: number, y: number) => void;
  selectedDistrict?: { x: number; y: number };
  detectivePosition?: { x: number; y: number };
}

export function GameBoard({
  districts,
  buildings,
  onDistrictClick,
  selectedDistrict,
  detectivePosition
}: GameBoardProps) {
  return (
    <div className="w-full max-w-4xl mx-auto">
      <div className="grid grid-cols-4 gap-2 p-4 bg-muted/20 rounded-lg">
        {districts.map((row, y) =>
          row.map((district, x) => (
            <DistrictComponent
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
  );
}

interface DistrictComponentProps {
  district: District;
  x: number;
  y: number;
  buildings: Building[];
  onClick?: () => void;
  isSelected: boolean;
  hasDetective: boolean;
}

function DistrictComponent({
  district,
  x,
  y,
  buildings,
  onClick,
  isSelected,
  hasDetective
}: DistrictComponentProps) {
  const isCorner = (x === 0 || x === 3) && (y === 0 || y === 3);
  const maxCitizens = isCorner ? 2 : 1;

  return (
    <Card
      className={cn(
        "relative p-2 min-h-[120px] cursor-pointer transition-all hover:shadow-md",
        isSelected && "ring-2 ring-primary",
        hasDetective && "bg-blue-100 dark:bg-blue-900/20"
      )}
      onClick={onClick}
    >
      {/* Координаты района */}
      <div className="absolute top-1 left-1 text-xs text-muted-foreground">
        {x},{y}
      </div>

      {/* Детектив */}
      {hasDetective && (
        <div className="absolute top-1 right-1">
          <Badge variant="secondary" className="text-xs">
            🚔
          </Badge>
        </div>
      )}

      {/* Здания */}
      <div className="space-y-1 mt-6">
        {buildings.map((building) => (
          <Badge
            key={building.id}
            variant="outline"
            className={cn(
              "text-xs",
              building.type === 'police' && "bg-blue-100 text-blue-800",
              building.type === 'hospital' && "bg-red-100 text-red-800",
              building.type === 'fire' && "bg-orange-100 text-orange-800",
              building.type === 'diner' && "bg-yellow-100 text-yellow-800"
            )}
          >
            {building.type === 'police' && '🚔'}
            {building.type === 'hospital' && '🏥'}
            {building.type === 'fire' && '🚒'}
            {building.type === 'diner' && '🍽️'}
          </Badge>
        ))}
      </div>

      {/* Граждане */}
      <div className="space-y-1 mt-2">
        {district.citizens.slice(0, maxCitizens).map((citizen, index) => (
          <div
            key={citizen.citizenId}
            className={cn(
              "text-xs p-1 rounded border",
              citizen.isScared && "bg-red-100 text-red-800 border-red-300",
              citizen.isDead && "bg-gray-100 text-gray-800 border-gray-300 opacity-50"
            )}
          >
            {citizen.isDead ? '💀' : citizen.isScared ? '😰' : '👤'} 
            ID: {citizen.citizenId}
          </div>
        ))}
        
        {/* Показать количество граждан если их больше максимума */}
        {district.citizens.length > maxCitizens && (
          <div className="text-xs text-muted-foreground">
            +{district.citizens.length - maxCitizens} еще
          </div>
        )}
      </div>

      {/* Максимум граждан для района */}
      <div className="absolute bottom-1 left-1 text-xs text-muted-foreground">
        {district.citizens.length}/{maxCitizens}
      </div>
    </Card>
  );
}
