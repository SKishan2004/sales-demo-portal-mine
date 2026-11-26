import { MOBILEUM_BRAND } from '@mobileum/shared';

interface MobileumBrandProps {
  subtitle?: string;
  size?: 'sm' | 'md' | 'lg';
}

export function MobileumBrand({
  subtitle = MOBILEUM_BRAND.adminTitle,
  size = 'md',
}: MobileumBrandProps) {
  const iconDimensions =
    size === 'sm' ? 'h-8 w-8' : size === 'lg' ? 'h-11 w-11' : 'h-9 w-9';
  const titleSize =
    size === 'sm' ? 'text-sm' : size === 'lg' ? 'text-lg' : 'text-[15px]';

  return (
    <div className="inline-flex items-center gap-2.5 select-none">
      <img
        src={`${import.meta.env.BASE_URL}assets/mobileum-logo.png`}
        alt="Mobileum official logo"
        className={`${iconDimensions} shrink-0 object-contain`}
      />
      <div className="flex flex-col leading-tight">
        <span className={`${titleSize} font-semibold tracking-tight text-slate-900`}>
          {MOBILEUM_BRAND.companyName}
        </span>
        <span className="text-[11px] font-medium text-[#1D4ED8]">
          {subtitle}
        </span>
      </div>
    </div>
  );
}
