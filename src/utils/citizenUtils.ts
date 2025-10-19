import { Citizen, CitizenGroup } from '../types/citizen';

// Определение групп граждан на основе профессий
const CITIZEN_GROUPS: Record<string, CitizenGroup> = {
  // Правительство
  'Судья': 'government',
  'Когрессмен': 'government', 
  'Мэр': 'government',
  'Посол': 'government',
  'Лоббист': 'government',
  
  // Криминал
  'Дон': 'criminal',
  'Гангстер': 'criminal',
  'Информатор': 'criminal',
  
  // Медицина
  'Коронер': 'medical',
  'Психиатр': 'medical',
  'Аптекарь': 'medical',
  'Хирург': 'medical',
  'Медсестра': 'medical',
  'Санитар': 'medical',
  'Ветеринар': 'medical',
  
  // Сервис
  'Ресторатор': 'service',
  'Бартендер': 'service',
  'Официантка': 'service',
  'Почтальон': 'service',
  'Стюардесса': 'service',
  'Водитель': 'service',
  'Вышибала': 'service',
  'Бриолинщик': 'service',
  'Мороженщик': 'service',
  
  // Развлечения
  'Актриса': 'entertainment',
  'Танцовщица': 'entertainment',
  'Диктор': 'entertainment',
  'Музыкант': 'entertainment',
  'Бейсболист': 'entertainment',
  'Фотограф': 'entertainment',
  
  // Образование
  'Профессор': 'education',
  'Библиотекарь': 'education',
  'Журналист': 'education',
  'Редактор': 'education',
  'Газетчик': 'education',
  
  // Экстренные службы
  'Пожарный': 'emergency',
  'Патрульный': 'emergency',
  'Инспектор': 'emergency',
  'Диспетчер': 'emergency',
  
  // Бизнес
  'Спекулянт': 'business',
  'Филантроп': 'business',
  'Вдова': 'business',
  'Кошатница': 'business',
  
  // Творчество
  'Художница': 'creative',
  'Гадалка': 'creative',
  'Ветеран': 'creative',
  'Агент': 'creative',
  'Моряк': 'creative',
  'Сварщица': 'creative',
  'Бездомный': 'creative',
  'Монашка': 'creative',
  'Секретарь': 'creative',
  'Адвокат': 'creative',
  'Прокурор': 'creative',
};

export function assignGroupsToCitizens(citizens: Citizen[]): Citizen[] {
  return citizens.map(citizen => ({
    ...citizen,
    group: CITIZEN_GROUPS[citizen.job] || 'business' // fallback группа
  }));
}

export function getCitizensByGroup(citizens: Citizen[], group: CitizenGroup): Citizen[] {
  return citizens.filter(citizen => citizen.group === group);
}

export function getRandomCitizen(citizens: Citizen[]): Citizen {
  const randomIndex = Math.floor(Math.random() * citizens.length);
  return citizens[randomIndex];
}

export function getRandomCitizens(citizens: Citizen[], count: number): Citizen[] {
  const shuffled = [...citizens].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, count);
}

export function getCitizenById(citizens: Citizen[], id: number): Citizen | undefined {
  return citizens.find(citizen => citizen.id === id);
}
