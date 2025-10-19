export interface Citizen {
  id: number;
  job: string;
  sex: 'male' | 'female';
  age: 20 | 40 | 60;
  size: 'S' | 'M' | 'L';
  height: 'small' | 'medium' | 'large';
  color: string;
  // Дополнительные поля для игры
  group?: string;
}

export interface CitizenPosition {
  citizenId: number;
  districtX: number;
  districtY: number;
  subPosition: 1 | 2 | 3;
  isScared: boolean;
  isDead: boolean;
}

export type CitizenGroup = 
  | 'government' 
  | 'criminal' 
  | 'medical' 
  | 'service' 
  | 'entertainment' 
  | 'education' 
  | 'emergency' 
  | 'business' 
  | 'creative';
