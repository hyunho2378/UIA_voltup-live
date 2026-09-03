import { useNavigate } from 'react-router-dom';
import GlassRoot from '../components/glass/GlassRoot.jsx';
import Glass from '../components/glass/Glass.jsx';
import GlassButton from '../components/glass/GlassButton.jsx';
import Ko from '../components/glass/Ko.jsx';
import { useSession } from '../lib/session-context.jsx';

export function LandingView({ ended = false, onGo = () => {} }) {
  return (
    <GlassRoot
      background="/images/bg/ambient-vote.webp"
      className="flex flex-col items-center justify-center gap-panel px-lg py-2xl"
    >
      <Glass variant="regular" radius="xl" className="w-full max-w-vote p-panel">
        <div key={ended ? 'ended' : 'live'} className="enter">
          <p className="balance text-question text-ink">
            <Ko>{ended ? '오늘 세션이 끝났어요' : '실시간 투표에 참여할 수 있어요'}</Ko>
          </p>
          {ended ? <p className="mt-sub text-body text-ink">참여해 주셔서 고맙습니다</p> : null}
        </div>
      </Glass>
      <GlassButton
        prominent
        disabled={ended}
        onClick={onGo}
        className={`w-full max-w-vote ${ended ? 'invisible pointer-events-none' : ''}`}
      >
        지금 참여하기
      </GlassButton>
    </GlassRoot>
  );
}

export default function Landing() {
  const navigate = useNavigate();
  const { session } = useSession();
  return <LandingView ended={session?.status === 'ended'} onGo={() => navigate('/vote')} />;
}
