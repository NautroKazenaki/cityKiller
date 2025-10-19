import { Citizen, CitizenPosition } from './citizen';

export interface GameState {
  id: string;
  status: 'waiting' | 'playing' | 'finished';
  currentPhase: 'setup' | 'day' | 'night';
  dayNumber: number;
  players: Player[];
  citizens: Citizen[];
  citizenPositions: CitizenPosition[];
  buildings: Building[];
  killer?: {
    citizenId: number;
    motive: string;
    allyGroup: string;
  };
  detective?: {
    positionX: number;
    positionY: number;
  };
  gameHistory: GameAction[];
}

export interface Player {
  id: string;
  username: string;
  role: 'detective' | 'killer';
  isActive: boolean;
}

export interface Building {
  id: string;
  type: 'police' | 'hospital' | 'fire' | 'diner';
  districtX: number;
  districtY: number;
  subPosition: number;
  isUsed: boolean;
}

export interface GameAction {
  id: string;
  playerId: string;
  actionType: 'move' | 'question' | 'kill' | 'scare' | 'use_building';
  actionData: any;
  timestamp: Date;
}

export interface District {
  x: number;
  y: number;
  citizens: CitizenPosition[];
  buildings: Building[];
  isHighlighted: boolean;
}

export type GamePhase = 'setup' | 'day' | 'night';
export type PlayerRole = 'detective' | 'killer';
export type BuildingType = 'police' | 'hospital' | 'fire' | 'diner';
