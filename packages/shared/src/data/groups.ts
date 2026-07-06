import { CitizenGroup } from '../types';

// Принадлежность профессий к 9 группам
export const CITIZEN_GROUPS: Record<string, CitizenGroup> = {
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

  // Творчество и прочие
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
  'Прокурор': 'creative'
};

export function getGroupForJob(job: string): CitizenGroup {
  return CITIZEN_GROUPS[job] ?? 'business';
}
