import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import GlassRoot from '../components/glass/GlassRoot.jsx';
import Glass from '../components/glass/Glass.jsx';
import GlassButton from '../components/glass/GlassButton.jsx';
import { adminLogin } from '../lib/admin.js';

export default function AdminLogin() {
  const navigate = useNavigate();
  const [code, setCode] = useState('');
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    const ok = await adminLogin(code);
    setBusy(false);
    if (ok) navigate('/admin', { replace: true });
    else setFailed(true);
  }

  return (
    <GlassRoot
      background="/images/bg/ambient-admin.webp"
      className="flex flex-col items-center justify-center gap-panel px-lg py-2xl"
    >
      <Glass variant="regular" radius="xl" className="w-full max-w-vote p-panel">
        <p className="text-caption text-ink">패스코드</p>
        <input
          value={code}
          onChange={(e) => {
            setCode(e.target.value);
            setFailed(false);
          }}
          onKeyDown={(e) => e.key === 'Enter' && code && !busy && submit()}
          type="password"
          inputMode="numeric"
          autoComplete="off"
          className="mt-md min-h-option w-full appearance-none rounded-md border border-optionBorder bg-optionFill px-optionX text-option text-ink outline-none tabular"
        />
        {failed ? <p className="mt-md text-caption text-ink">패스코드가 달라요</p> : null}
      </Glass>
      <GlassButton prominent disabled={!code || busy} onClick={submit} className="w-full max-w-vote">
        들어가기
      </GlassButton>
    </GlassRoot>
  );
}
