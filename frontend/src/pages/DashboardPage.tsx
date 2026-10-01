import React, { useState } from 'react';
import { DashboardHero } from '../components/dashboard/DashboardHero';
import { WeightedBlendPipeline } from '../components/dashboard/WeightedBlendPipeline';
import { ModelIntelligenceSection } from '../components/dashboard/ModelIntelligenceSection';
import { AiWeightEngineSection } from '../components/dashboard/AiWeightEngineSection';
import { CalibrationAuditSection } from '../components/dashboard/CalibrationAuditSection';
import { ModelComparisonTable } from '../components/dashboard/ModelComparisonTable';
import { BlendedForecastCard } from '../components/dashboard/BlendedForecastCard';
import { ModelAgreementCard } from '../components/dashboard/ModelAgreementCard';
import { WeatherRegimeCard } from '../components/dashboard/WeatherRegimeCard';
import { UncertaintyDistributionCard } from '../components/dashboard/UncertaintyDistributionCard';
import { DashboardForecastTimeline } from '../components/dashboard/DashboardForecastTimeline';
import { ExtremeWeatherGuidance } from '../components/dashboard/ExtremeWeatherGuidance';
import { DataEvidenceSection } from '../components/dashboard/DataEvidenceSection';

export const DashboardPage: React.FC = () => {
  const [explainModalOpen, setExplainModalOpen] = useState(false);

  return (
    <div className="space-y-8 pb-12">
      {/* 1. Flagship 3D Hero Section */}
      <DashboardHero />

      {/* 2. Visual Blending Pipeline (Data Flow Architecture) */}
      <WeightedBlendPipeline />

      {/* 3. Model Intelligence Section (Core Focus: IFS, GFS, ICON, AIFS) */}
      <ModelIntelligenceSection onOpenExplain={() => setExplainModalOpen(true)} />

      {/* 4. Model Comparison Matrix Table */}
      <ModelComparisonTable />

      {/* 5. AI Weight Engine & Explanation */}
      <AiWeightEngineSection 
        isOpen={explainModalOpen} 
        onClose={() => setExplainModalOpen(false)} 
      />

      {/* 6. Calibration Audit (Empirical ERA5 Reanalysis Benchmark) */}
      <CalibrationAuditSection />

      {/* 7. Hybrid Forecast Synthesis & Roadmap Stack */}
      <BlendedForecastCard />

      {/* 8. Agreement, Regime & Ensemble Uncertainty Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <ModelAgreementCard />
        <WeatherRegimeCard />
        <UncertaintyDistributionCard />
      </div>

      {/* 9. Interactive Forecast Timeline (Next 24h Hourly Trajectory) */}
      <DashboardForecastTimeline />

      {/* 10. Extreme Weather Guidance & Official SACHET Alerts */}
      <ExtremeWeatherGuidance />

      {/* 11. Upstream Data Sources & Grounding Audit */}
      <DataEvidenceSection />
    </div>
  );
};
