import { useNavigate, useParams } from '@tanstack/react-router';
import { MOTIVE_DESCRIPTORS } from '@citykiller/shared';
import { GROUP_LABELS } from '@/lib/labels';
import { useGameRoom } from '@/hooks/useGameRoom';
import { DetectiveScreen } from '@/components/game/DetectiveScreen';
import { KillerScreen } from '@/components/game/KillerScreen';
import { CenterCard, NoirButton } from '@/components/game/shell/CenterCard';
import { Lobby } from '@/components/game/shell/Lobby';
import { FinalDialog, type FinalRow } from '@/components/game/FinalDialog';

export function GamePage() {
  const { roomCode } = useParams({ from: '/game/$roomCode' });
  const room = useGameRoom(roomCode);
  const navigate = useNavigate();
  const toMenu = () => navigate({ to: '/' });

  if (!room.session) {
    return (
      <CenterCard title="Нет доступа к делу">
        <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.6, color: 'oklch(0.72 0.014 80)' }}>
          Данные сессии не найдены. Вернитесь в меню и войдите по коду комнаты.
        </p>
        <NoirButton label="В меню" onClick={toMenu} />
      </CenterCard>
    );
  }

  if (room.connectionError) {
    return (
      <CenterCard title="Ошибка подключения">
        <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.6, color: 'oklch(0.85 0.1 30)' }}>
          {room.connectionError}
        </p>
        <NoirButton label="В меню" onClick={toMenu} />
      </CenterCard>
    );
  }

  const opponentRole = room.session.role === 'detective' ? 'killer' : 'detective';
  const opponentInfo = room.roomInfo?.players[opponentRole];

  // Лобби: ждём второго игрока
  if (!room.view) {
    return (
      <Lobby
        roomCode={room.session.roomCode}
        myRole={room.session.role}
        myName={room.session.username}
        opponentRole={opponentRole}
        opponentName={opponentInfo?.username ?? null}
      />
    );
  }

  const common = {
    sendCommand: room.sendCommand,
    actionError: room.actionError,
    roomCode: room.session.roomCode,
    myName: room.session.username,
    opponentConnected: opponentInfo?.connected ?? false,
    onMenu: toMenu
  };

  // Итоги для финального документа
  const view = room.view;
  const questions = view.answers.length;
  const tokenAnswers = view.policeAnswers.length;
  const lastVictim = view.victims[view.victims.length - 1];

  // Разгадка: детективу её присылают только в финале, убийца знал её всю партию
  const reveal = view.role === 'detective' ? view.reveal : view.killer;
  const killerCitizen = reveal ? view.citizens.find(c => c.id === reveal.citizenId) : undefined;
  const trueMotive = reveal ? MOTIVE_DESCRIPTORS.find(m => m.id === reveal.motiveId) : undefined;

  const finalRows: FinalRow[] = [
    ...(killerCitizen
      ? [
          {
            label: 'УБИЙЦЕЙ БЫЛ',
            value: `${killerCitizen.job} · ${GROUP_LABELS[killerCitizen.group]}`,
            strong: true,
            tone: 'bad' as const
          }
        ]
      : []),
    ...(trueMotive
      ? [{ label: 'МОТИВ', value: `${trueMotive.title} — ${trueMotive.description}`, tone: 'ink' as const }]
      : []),
    ...(reveal
      ? [{ label: 'ЕМУ ПОДЫГРЫВАЛИ', value: GROUP_LABELS[reveal.allyGroup], tone: 'ink' as const }]
      : []),
    {
      label: 'ЖЕРТВ',
      value: lastVictim
        ? `${view.killsCount} из 5 · последняя на ходу ${lastVictim.turnNumber}`
        : `${view.killsCount} из 5`,
      tone: 'ink'
    },
    {
      label: 'ВОПРОСОВ ЗАДАНО',
      value:
        questions === 0
          ? 'ни одного'
          : `${questions} · из них ${tokenAnswers} по жетонам полиции`,
      tone: 'ink'
    },
    {
      label: 'ХОДОВ СЫГРАНО',
      value: String(view.turnNumber),
      tone: 'ink'
    },
    {
      label: 'ИСХОД',
      value: view.winner === 'detective' ? 'Победа детектива' : 'Победа убийцы',
      strong: true,
      tone: view.winner === room.session.role ? 'good' : 'bad'
    }
  ];

  return (
    <div style={{ width: '100vw', height: '100vh', overflow: 'hidden' }}>
      {room.view.role === 'detective' ? (
        <DetectiveScreen
          view={room.view}
          {...common}
          opponentName={opponentInfo?.username ?? 'Убийца'}
        />
      ) : (
        <KillerScreen
          view={room.view}
          {...common}
          opponentName={opponentInfo?.username ?? 'Детектив'}
        />
      )}
      <FinalDialog
        open={room.view.phase === 'finished'}
        solved={room.view.winner === 'detective'}
        reason={room.view.winReason}
        roomCode={room.session.roomCode}
        turnNumber={room.view.turnNumber}
        rows={finalRows}
        onMenu={toMenu}
      />
    </div>
  );
}
