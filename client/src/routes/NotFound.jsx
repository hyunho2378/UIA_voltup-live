import { useNavigate } from 'react-router-dom';
import GlassRoot from '../components/glass/GlassRoot.jsx';
import Glass from '../components/glass/Glass.jsx';
import GlassButton from '../components/glass/GlassButton.jsx';

export default function NotFound() {
  const navigate = useNavigate();
  return (
    <GlassRoot
      background="/images/bg/ambient-vote.webp"
      className="flex flex-col items-center justify-center gap-panel px-lg py-2xl"
    >
      <Glass variant="regular" radius="xl" className="w-full max-w-vote p-panel">
        <p className="balance text-question text-ink">없는 페이지예요</p>
      </Glass>
      <GlassButton prominent onClick={() => navigate('/vote')} className="w-full max-w-vote">
        투표 화면으로
      </GlassButton>
    </GlassRoot>
  );
}
