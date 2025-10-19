import { Citizen, CitizenPosition } from '@/types/citizen';
import { Building, District, GameState } from '@/types/game';

// Генерация позиций зданий на карте 4x4
export function generateBuildings(): Building[] {
  const buildingTypes: Array<'police' | 'hospital' | 'fire' | 'diner'> = 
    ['police', 'hospital', 'fire', 'diner'];
  
  const buildings: Building[] = [];
  
  // Создаем по 2 здания каждого типа
  buildingTypes.forEach((type, typeIndex) => {
    for (let i = 0; i < 2; i++) {
      const buildingId = typeIndex * 2 + i + 1;
      
      // Генерируем случайную позицию
      let x: number, y: number, subPosition: number;
      let attempts = 0;
      
      do {
        x = Math.floor(Math.random() * 4);
        y = Math.floor(Math.random() * 4);
        subPosition = Math.floor(Math.random() * 3) + 1;
        attempts++;
      } while (
        // Проверяем, что в этом районе еще нет здания этого типа
        buildings.some(b => b.districtX === x && b.districtY === y && b.type === type) ||
        attempts < 100
      );
      
      buildings.push({
        id: `building-${buildingId}`,
        type,
        districtX: x,
        districtY: y,
        subPosition,
        isUsed: false
      });
    }
  });
  
  return buildings;
}

// Размещение граждан по районам
export function placeCitizensOnMap(citizens: Citizen[]): CitizenPosition[] {
  const positions: CitizenPosition[] = [];
  
  // Создаем карту размещения граждан
  const districtMap: CitizenPosition[][] = Array(4).fill(null).map(() => Array(4).fill(null).map(() => []));
  
  // Размещаем 20 случайных граждан
  const selectedCitizens = citizens.slice(0, 20);
  
  selectedCitizens.forEach((citizen) => {
    let placed = false;
    let attempts = 0;
    
    while (!placed && attempts < 100) {
      const x = Math.floor(Math.random() * 4);
      const y = Math.floor(Math.random() * 4);
      
      // Проверяем ограничения размещения
      const isCorner = (x === 0 || x === 3) && (y === 0 || y === 3);
      const maxCitizens = isCorner ? 2 : 1;
      
      if (districtMap[y][x].length < maxCitizens) {
        const subPosition = districtMap[y][x].length + 1;
        
        positions.push({
          citizenId: citizen.id,
          districtX: x,
          districtY: y,
          subPosition: subPosition as 1 | 2 | 3,
          isScared: false,
          isDead: false
        });
        
        districtMap[y][x].push(positions[positions.length - 1]);
        placed = true;
      }
      
      attempts++;
    }
  });
  
  return positions;
}

// Создание матрицы районов
export function createDistricts(citizenPositions: CitizenPosition[]): District[][] {
  const districts: District[][] = [];
  
  for (let y = 0; y < 4; y++) {
    const row: District[] = [];
    for (let x = 0; x < 4; x++) {
      const citizens = citizenPositions.filter(pos => pos.districtX === x && pos.districtY === y);
      
      row.push({
        x,
        y,
        citizens,
        buildings: [], // Будет заполнено отдельно
        isHighlighted: false
      });
    }
    districts.push(row);
  }
  
  return districts;
}

// Обновление зданий в районах
export function updateDistrictsWithBuildings(districts: District[][], buildings: Building[]): District[][] {
  return districts.map(row =>
    row.map(district => ({
      ...district,
      buildings: buildings.filter(b => b.districtX === district.x && b.districtY === district.y)
    }))
  );
}

// Получение соседних районов
export function getNeighboringDistricts(x: number, y: number): Array<{x: number, y: number}> {
  const neighbors = [];
  
  for (let dx = -1; dx <= 1; dx++) {
    for (let dy = -1; dy <= 1; dy++) {
      if (dx === 0 && dy === 0) continue;
      
      const newX = x + dx;
      const newY = y + dy;
      
      if (newX >= 0 && newX < 4 && newY >= 0 && newY < 4) {
        neighbors.push({ x: newX, y: newY });
      }
    }
  }
  
  return neighbors;
}

// Проверка валидности перемещения
export function canMoveCitizen(
  citizenPos: CitizenPosition,
  targetX: number,
  targetY: number,
  citizenPositions: CitizenPosition[]
): boolean {
  // Проверяем, что целевой район существует
  if (targetX < 0 || targetX >= 4 || targetY < 0 || targetY >= 4) {
    return false;
  }
  
  // Проверяем ограничения по количеству граждан в целевом районе
  const isCorner = (targetX === 0 || targetX === 3) && (targetY === 0 || targetY === 3);
  const maxCitizens = isCorner ? 2 : 1;
  
  const currentCitizensInTarget = citizenPositions.filter(
    pos => pos.districtX === targetX && pos.districtY === targetY && pos.citizenId !== citizenPos.citizenId
  ).length;
  
  return currentCitizensInTarget < maxCitizens;
}
