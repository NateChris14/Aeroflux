import { SimulationProvider } from './context/SimulationContext';
import { Header } from './components/Header';
import { LeftPanel } from './components/Panels/LeftPanel';
import { RightPanel } from './components/Panels/RightPanel';
import { AgentFeed } from './components/Panels/AgentFeed';
import { MapboxGlobe } from './components/Globe/MapboxGlobe';

function App() {
  return (
    <SimulationProvider>
      <div className="h-screen w-screen bg-af-bg flex flex-col overflow-hidden">
        <Header />
        
        <main className="flex-1 flex overflow-hidden">
          {/* Left Panel */}
          <LeftPanel />
          
          {/* Center: Globe + Agent Feed */}
          <div className="flex-1 flex flex-col min-w-0">
            <MapboxGlobe />
            <AgentFeed />
          </div>
          
          {/* Right Panel */}
          <RightPanel />
        </main>
        
      </div>
    </SimulationProvider>
  );
}

export default App;
