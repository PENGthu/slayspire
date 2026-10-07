import { useStore } from './store';
import { CompendiumScreen } from './screens/Compendium';
import { GameScreen } from './screens/Game';
import { MenuScreen, SetupScreen } from './screens/Menu';
import { LobbyScreen, OnlineScreen } from './screens/Online';
import { RulesScreen } from './screens/Rules';

export function App() {
  const s = useStore();
  switch (s.screen) {
    case 'menu':
      return <MenuScreen />;
    case 'setup':
      return <SetupScreen />;
    case 'rules':
      return <RulesScreen />;
    case 'compendium':
      return <CompendiumScreen />;
    case 'online':
      return <OnlineScreen />;
    case 'lobby':
      return <LobbyScreen />;
    case 'game':
      return s.g ? <GameScreen /> : <MenuScreen />;
  }
}
