import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { Citizen } from '@/types/citizen';

interface CitizenCardProps {
  citizen: Citizen;
  isSelected?: boolean;
  isScared?: boolean;
  isDead?: boolean;
  onClick?: () => void;
  showDetails?: boolean;
}

export function CitizenCard({
  citizen,
  isSelected = false,
  isScared = false,
  isDead = false,
  onClick,
  showDetails = false
}: CitizenCardProps) {
  const getSexEmoji = (sex: string) => sex === 'male' ? '👨' : '👩';
  const getAgeEmoji = (age: number) => age <= 30 ? '👶' : age <= 50 ? '🧑' : '👴';
  const getSizeEmoji = (size: string) => {
    switch (size) {
      case 'S': return '🦐';
      case 'M': return '👤';
      case 'L': return '🐻';
      default: return '👤';
    }
  };
  const getHeightEmoji = (height: string) => {
    switch (height) {
      case 'small': return '📏';
      case 'medium': return '📐';
      case 'large': return '📏';
      default: return '📏';
    }
  };

  return (
    <Card
      className={cn(
        "cursor-pointer transition-all hover:shadow-md",
        isSelected && "ring-2 ring-primary",
        isScared && "bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800",
        isDead && "bg-gray-50 border-gray-200 dark:bg-gray-900/20 dark:border-gray-800 opacity-60"
      )}
      onClick={onClick}
    >
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center justify-between">
          <span className="truncate">{citizen.job}</span>
          <div className="flex gap-1">
            {isDead && <span className="text-lg">💀</span>}
            {isScared && !isDead && <span className="text-lg">😰</span>}
            {!isScared && !isDead && <span className="text-lg">{getSexEmoji(citizen.sex)}</span>}
          </div>
        </CardTitle>
      </CardHeader>
      
      <CardContent className="pt-0">
        <div className="space-y-2">
          {/* Основные характеристики */}
          <div className="flex flex-wrap gap-1">
            <Badge variant="outline" className="text-xs">
              {getSexEmoji(citizen.sex)} {citizen.sex === 'male' ? 'М' : 'Ж'}
            </Badge>
            <Badge variant="outline" className="text-xs">
              {citizen.age} лет
            </Badge>
          </div>
          
          {/* Физические характеристики */}
          <div className="flex flex-wrap gap-1">
            <Badge variant="secondary" className="text-xs">
              {getSizeEmoji(citizen.size)} {citizen.size}
            </Badge>
            <Badge variant="secondary" className="text-xs">
              {getHeightEmoji(citizen.height)} {citizen.height === 'small' ? 'Низкий' : citizen.height === 'medium' ? 'Средний' : 'Высокий'}
            </Badge>
          </div>
          
          {/* Группа */}
          {citizen.group && (
            <Badge variant="default" className="text-xs">
              {citizen.group}
            </Badge>
          )}
          
          {/* Детальная информация */}
          {showDetails && (
            <div className="text-xs text-muted-foreground space-y-1 pt-2 border-t">
              <div>ID: {citizen.id}</div>
              <div>Цвет: {citizen.color}</div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
