import type {
  BuildingType,
  CitizenGroup,
  Height,
  QuestionAttribute,
  QuestionValue,
  Sex
} from '@citykiller/shared';

export const GROUP_LABELS: Record<CitizenGroup, string> = {
  government: 'Власть',
  criminal: 'Криминал',
  medical: 'Медицина',
  service: 'Сервис',
  entertainment: 'Развлечения',
  education: 'Образование',
  emergency: 'Экстренные службы',
  business: 'Бизнес',
  creative: 'Творчество'
};

/** Короткие подписи групп для тесных карточек на доске */
export const GROUP_SHORT: Record<CitizenGroup, string> = {
  government: 'Власть',
  criminal: 'Крим.',
  medical: 'Мед.',
  service: 'Сервис',
  entertainment: 'Развл.',
  education: 'Образ.',
  emergency: 'Экстр.',
  business: 'Бизнес',
  creative: 'Творч.'
};

/** Короткий рост: н / ср / выс */
export const HEIGHT_SHORT: Record<Height, string> = {
  small: 'низк.',
  medium: 'сред.',
  large: 'выс.'
};

export const SEX_EMOJI: Record<Sex, string> = {
  male: '♂',
  female: '♀'
};

export const BUILDING_LABELS: Record<BuildingType, string> = {
  police: 'Полицейский участок',
  hospital: 'Больница',
  fire: 'Пожарная часть',
  diner: 'Закусочная'
};

export const BUILDING_EMOJI: Record<BuildingType, string> = {
  police: '🚔',
  hospital: '🏥',
  fire: '🚒',
  diner: '🍽️'
};

export const ATTRIBUTE_LABELS: Record<QuestionAttribute, string> = {
  sex: 'Пол',
  age: 'Возраст',
  size: 'Телосложение',
  height: 'Рост'
};

export const ATTRIBUTE_VALUES: Record<QuestionAttribute, Array<{ value: QuestionValue; label: string }>> = {
  sex: [
    { value: 'male', label: 'мужской' },
    { value: 'female', label: 'женский' }
  ],
  age: [
    { value: 20, label: '20 лет' },
    { value: 40, label: '40 лет' },
    { value: 60, label: '60 лет' }
  ],
  size: [
    { value: 'S', label: 'S (маленькое)' },
    { value: 'M', label: 'M (среднее)' },
    { value: 'L', label: 'L (крупное)' }
  ],
  height: [
    { value: 'small', label: 'низкий' },
    { value: 'medium', label: 'средний' },
    { value: 'large', label: 'высокий' }
  ]
};

/** Имя квартала в стиле «A1» (колонка-буква, ряд-число) */
export function districtName(x: number, y: number): string {
  return `${String.fromCharCode(65 + x)}${y + 1}`;
}

export function valueLabel(attribute: QuestionAttribute, value: QuestionValue): string {
  return ATTRIBUTE_VALUES[attribute].find(v => v.value === value)?.label ?? String(value);
}

export function questionText(attribute: QuestionAttribute, value: QuestionValue): string {
  switch (attribute) {
    case 'sex':
      return `Убийца ${value === 'male' ? 'мужского' : 'женского'} пола?`;
    case 'age':
      return `Убийце ${value} лет?`;
    case 'size':
      return `У убийцы телосложение ${value}?`;
    case 'height':
      return `Убийца ${valueLabel('height', value)} по росту?`;
  }
}
