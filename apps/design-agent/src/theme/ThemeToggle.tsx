import { MoonOutlined, SunOutlined } from '@ant-design/icons';
import { Button, Tooltip } from '@da/ui';
import { useThemeStore } from '../stores/themeStore';

/** 明暗主题切换按钮 */
export function ThemeToggle() {
  const mode = useThemeStore((s) => s.mode);
  const toggleMode = useThemeStore((s) => s.toggleMode);
  const isDark = mode === 'dark';

  return (
    <Tooltip title={isDark ? '切换为浅色' : '切换为深色'}>
      <Button
        size="small"
        type="text"
        icon={isDark ? <SunOutlined /> : <MoonOutlined />}
        aria-label={isDark ? '切换为浅色' : '切换为深色'}
        onClick={toggleMode}
        className="text-[var(--text-secondary)] hover:text-[var(--text-primary)]!"
      />
    </Tooltip>
  );
}
