// Доменные типы игры City Killer

export type Sex = 'male' | 'female';
export type Age = 20 | 40 | 60;
export type BodySize = 'S' | 'M' | 'L';
export type Height = 'small' | 'medium' | 'large';

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

export const ALL_GROUPS: CitizenGroup[] = [
  'government',
  'criminal',
  'medical',
  'service',
  'entertainment',
  'education',
  'emergency',
  'business',
  'creative'
];

export interface Citizen {
  id: number;
  job: string;
  sex: Sex;
  age: Age;
  size: BodySize;
  height: Height;
  color: string;
  group: CitizenGroup;
}

export interface CitizenPosition {
  citizenId: number;
  districtX: number;
  districtY: number;
  subPosition: 1 | 2 | 3;
  isScared: boolean;
  isDead: boolean;
}

export type BuildingType = 'police' | 'hospital' | 'fire' | 'diner';

export interface Building {
  id: string;
  type: BuildingType;
  districtX: number;
  districtY: number;
  subPosition: number;
}

export type PlayerRole = 'detective' | 'killer';

export type GamePhase =
  | 'setup' // детектив ставит машину
  | 'night' // ход убийцы: 2 испуга + 1 убийство
  | 'relocation' // детектив расселяет жителей с места преступления
  | 'day' // ход детектива: 2 перемещения + 2 возможности
  | 'accusation' // после 5-го убийства: обязательное обвинение
  | 'finished';

// Вопрос о характеристике убийцы: «убийца мужского пола?», «убийце 20 лет?» и т.д.
export type QuestionAttribute = 'sex' | 'age' | 'size' | 'height';

export type QuestionValue = Sex | Age | BodySize | Height;

export interface PendingQuestion {
  id: string;
  citizenId: number;
  attribute: QuestionAttribute;
  value: QuestionValue;
  /** Вопрос задан через закусочную (в соседнем районе) */
  viaDiner: boolean;
  /** Правдивый ответ (видит только сервер/убийца) */
  truth: boolean;
  /** Обязан ли убийца ответить честно (не свой персонаж и не группа-помощник) */
  mustBeHonest: boolean;
}

export interface AnsweredQuestion {
  id: string;
  citizenId: number;
  attribute: QuestionAttribute;
  value: QuestionValue;
  answer: boolean;
  viaDiner: boolean;
  turnNumber: number;
}

export interface PoliceTokenAnswer {
  citizenId: number;
  /** «Можешь ли ты убить этого жителя прямо сейчас?» — всегда честно */
  canKill: boolean;
  turnNumber: number;
}

export interface PoliceToken {
  citizenId: number;
  placedTurn: number;
}

export interface DetectiveTurn {
  movesLeft: number;
  abilitiesLeft: number;
  /** Район, в котором уже задавали обычный вопрос в этот ход (нельзя спрашивать в двух разных) */
  questionedDistrict: { x: number; y: number } | null;
  /** Здания, уже активированные в этот ход */
  usedBuildingIds: string[];
}

export interface NightState {
  scaredIds: number[];
  killedId: number | null;
}

export interface KillerInfo {
  citizenId: number;
  motiveId: string;
  allyGroup: CitizenGroup;
}

/** Жертва в порядке убийства (для мотивов и колонки морга) */
export interface Victim {
  citizenId: number;
  districtX: number;
  districtY: number;
  turnNumber: number;
}

export interface GameLogEntry {
  seq: number;
  turnNumber: number;
  /** Кто совершил действие */
  role: PlayerRole | 'system';
  /** Человекочитаемое описание — попадает в лог обеих сторон, без секретов */
  message: string;
}

export interface GameState {
  id: string;
  phase: GamePhase;
  turnNumber: number;
  citizens: Citizen[];
  positions: CitizenPosition[];
  buildings: Building[];
  killer: KillerInfo;
  /** 6 мотивов-кандидатов (id), среди которых ровно один настоящий (killer.motiveId) */
  motiveOptions: string[];
  detective: { x: number; y: number } | null;
  killsCount: number;
  /** Жертвы в порядке убийства */
  victims: Victim[];
  /** Район последнего убийства (для фазы relocation) */
  lastCrimeDistrict: { x: number; y: number } | null;
  policeTokens: PoliceToken[];
  turn: DetectiveTurn;
  lastNight: NightState | null;
  pendingQuestion: PendingQuestion | null;
  answers: AnsweredQuestion[];
  policeAnswers: PoliceTokenAnswer[];
  winner: PlayerRole | null;
  winReason: string | null;
  log: GameLogEntry[];
}

// ==== Команды игроков ====

export interface PlaceCarCommand {
  type: 'detective:placeCar';
  x: number;
  y: number;
}

export interface NightCommand {
  type: 'killer:night';
  scareIds: number[];
  /** null — только если ни одна жертва не подходит под мотив/правила */
  killId: number | null;
}

export interface RelocateCommand {
  type: 'detective:relocate';
  moves: Array<{ citizenId: number; toX: number; toY: number }>;
}

export interface MoveCommand {
  type: 'detective:move';
  x: number;
  y: number;
}

export interface QuestionCommand {
  type: 'detective:question';
  citizenId: number;
  attribute: QuestionAttribute;
  value: QuestionValue;
}

export interface AnswerCommand {
  type: 'killer:answer';
  questionId: string;
  answer: boolean;
}

export interface UseBuildingCommand {
  type: 'detective:useBuilding';
  buildingId: string;
  payload:
    | { kind: 'fire'; group: CitizenGroup; moves: Array<{ citizenId: number; toX: number; toY: number }> }
    | { kind: 'diner'; citizenId: number; attribute: QuestionAttribute; value: QuestionValue }
    | { kind: 'police'; citizenId: number }
    | { kind: 'hospital'; citizenId: number };
}

export interface PoliceQuestionCommand {
  type: 'detective:policeQuestion';
  citizenId: number;
}

export interface EndTurnCommand {
  type: 'detective:endTurn';
}

export interface AccuseCommand {
  type: 'detective:accuse';
  job: string;
  motiveId: string;
}

export type GameCommand =
  | PlaceCarCommand
  | NightCommand
  | RelocateCommand
  | MoveCommand
  | QuestionCommand
  | AnswerCommand
  | UseBuildingCommand
  | PoliceQuestionCommand
  | EndTurnCommand
  | AccuseCommand;

// ==== Виды состояния для каждой стороны ====

/** Вопрос, как его видит детектив (без правды и без флага честности) */
export interface PendingQuestionPublic {
  id: string;
  citizenId: number;
  attribute: QuestionAttribute;
  value: QuestionValue;
  viaDiner: boolean;
}

export interface DetectiveView {
  role: 'detective';
  id: string;
  phase: GamePhase;
  turnNumber: number;
  citizens: Citizen[];
  positions: CitizenPosition[];
  buildings: Building[];
  /** 6 мотивов-кандидатов (id), среди которых ровно один настоящий */
  motiveOptions: string[];
  detective: { x: number; y: number } | null;
  killsCount: number;
  victims: Victim[];
  lastCrimeDistrict: { x: number; y: number } | null;
  policeTokens: PoliceToken[];
  turn: DetectiveTurn;
  pendingQuestion: PendingQuestionPublic | null;
  answers: AnsweredQuestion[];
  policeAnswers: PoliceTokenAnswer[];
  winner: PlayerRole | null;
  winReason: string | null;
  log: GameLogEntry[];
}

export interface KillerView {
  role: 'killer';
  id: string;
  phase: GamePhase;
  turnNumber: number;
  citizens: Citizen[];
  positions: CitizenPosition[];
  buildings: Building[];
  killer: KillerInfo;
  /** 6 мотивов-кандидатов (id), которые видит детектив; настоящий — killer.motiveId */
  motiveOptions: string[];
  /** Жертвы, доступные этой ночью по мотиву и правилам */
  validKillTargets: number[];
  detective: { x: number; y: number } | null;
  killsCount: number;
  victims: Victim[];
  lastCrimeDistrict: { x: number; y: number } | null;
  policeTokens: PoliceToken[];
  turn: DetectiveTurn;
  pendingQuestion: PendingQuestion | null;
  answers: AnsweredQuestion[];
  policeAnswers: PoliceTokenAnswer[];
  winner: PlayerRole | null;
  winReason: string | null;
  log: GameLogEntry[];
}

export type GameView = DetectiveView | KillerView;
