import { type Skin, type WeaponId } from './data';

export default function WeaponArt({ id, skin }: { id: WeaponId; skin: Skin }) {
  const long = id === 'phantom';
  const short = id === 'spectre';
  const pistol = id === 'p12' || id === 'r45';
  const shotgun = id === 'bulldog';
  const gradient = `gun-${id}-${skin.id}`;
  if (pistol) return <svg className={`weapon-drawing weapon-${id}`} viewBox="0 0 420 160" fill="none" aria-hidden="true">
    <defs><linearGradient id={gradient} x1="0" y1="0" x2="0" y2="1"><stop stopColor={skin.detail} /><stop offset="1" stopColor={skin.body} /></linearGradient></defs>
    <path d={`M115 55h${id === 'r45' ? 155 : 135}l14 8v25h-72l-12 9h-57l-12-9h-16Z`} fill={`url(#${gradient})`} stroke={skin.accent} strokeWidth="2" />
    <path d="M145 89h58l-10 47-10 8h-40l7-37-8-8Z" fill={skin.body} stroke={skin.accent} strokeWidth="2" />
    <path d="M158 99h34l-6 35h-32Z" fill="#293c38" stroke={skin.detail} /><path d="M160 106h26M158 113h27M157 120h26" stroke={skin.accent} strokeOpacity=".6" />
    <path d="M202 88h36l-4 14h-24l-5 8h-13l6-17Z" fill="#293c38" stroke={skin.detail} /><path d="M128 62h102M128 68h102M128 74h102" stroke={skin.accent} strokeOpacity=".5" />
    <path d="M131 55v-6h14v6M235 55v-6h15v6" stroke={skin.accent} strokeWidth="3" />
    {id === 'r45' && <path d="M270 63h24v24h-24M278 68v14M285 68v14" fill={skin.body} stroke={skin.accent} strokeWidth="2" />}
  </svg>;
  return <svg className={`weapon-drawing weapon-${id}`} viewBox="0 0 420 160" fill="none" aria-hidden="true">
    <defs><linearGradient id={gradient} x1="0" y1="0" x2="0" y2="1"><stop stopColor={skin.detail} /><stop offset="1" stopColor={skin.body} /></linearGradient></defs>
    <path d="M35 67h31l13 9h47l13-9h101l11 8h29v23H137l-16-5H75l-12 13H36l10-19-11-6Z" fill={`url(#${gradient})`} stroke={skin.accent} strokeWidth="1.4" />
    <path d="M39 70h25l10 7H55l-8 21h-8l10-19-10-3Z" fill="#273735" stroke={skin.detail} />
    <path d="M130 66v-8h96l11 8M161 58v-7h43v7M179 51v-9h20l7 9" fill={skin.body} stroke={skin.accent} strokeWidth="1.5" />
    <path d="M149 72h80v19h-80z" fill={skin.body} stroke={skin.accent} /><path d="M157 77h61M157 82h61M157 87h61" stroke={skin.accent} strokeOpacity=".55" />
    <path d="M194 94h29l-4 33-9 9h-21l4-12Z" fill={skin.body} stroke={skin.accent} strokeWidth="1.2" /><path d="M200 102h16M198 109h17M197 116h17" stroke={skin.detail} />
    <path d="M145 94h31l-6 15h-13l-7 21h-15l8-29Z" fill="#2e3e3a" stroke={skin.detail} /><path d="M157 96h15l-3 8h-8Z" stroke={skin.accent} />
    <path d={`M279 77h${short ? 50 : 82}v14h-${short ? 50 : 82}z`} fill={skin.body} stroke={skin.detail} /><path d={`M${short ? 329 : 361} 81h${long ? 45 : 25}v7h-${long ? 45 : 25}z`} fill="#253532" stroke={skin.detail} />
    <path d="M245 77h25M245 82h25M245 87h25" stroke={skin.accent} strokeOpacity=".6" /><path d="M94 76h25M88 84h28" stroke={skin.accent} />
    {long && <><path d="M168 42h48l-5-10h-38Z" fill={skin.body} stroke={skin.accent} /><path d="M178 31h29" stroke={skin.accent} strokeWidth="2" /></>}
    {short && <path d="M235 97h21l-3 19h-10Z" fill={skin.body} stroke={skin.detail} />}
    {shotgun && <><path d="M245 96h105v9H245z" fill={skin.body} stroke={skin.accent} /><path d="M258 97v8M270 97v8M282 97v8M294 97v8M306 97v8" stroke={skin.accent} /></>}
  </svg>;
}