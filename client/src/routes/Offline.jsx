import GlassRoot from '../components/glass/GlassRoot.jsx';
import Glass from '../components/glass/Glass.jsx';
import Ko from '../components/glass/Ko.jsx';

// 자동 복구 화면. 수동 버튼을 두지 않는다. 연결이 돌아오면 호출한 쪽이 알아서 원래 화면으로 돌아간다.
export default function Offline() {
  return (
    <GlassRoot
      background="/images/bg/ambient-vote.webp"
      className="flex items-center justify-center px-lg py-2xl"
    >
      <Glass variant="regular" radius="xl" className="w-full max-w-vote p-panel">
        <p className="balance text-question text-ink"><Ko>연결이 잠시 끊겼어요</Ko></p>
        <p className="mt-sub text-body text-ink">잠시 후 다시 시도할게요</p>
      </Glass>
    </GlassRoot>
  );
}
