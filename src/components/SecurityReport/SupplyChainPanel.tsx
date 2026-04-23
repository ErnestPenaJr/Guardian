import React, { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import type { SupplyChainSummary } from './types';

interface SupplyChainPanelProps {
    summary: SupplyChainSummary;
}

const Row: React.FC<{ label: string; value: React.ReactNode }> = ({ label, value }) => (
    <div className="flex justify-between py-1 text-sm">
        <span className="text-gray-600">{label}</span>
        <span className="font-mono">{value}</span>
    </div>
);

const SupplyChainPanel: React.FC<SupplyChainPanelProps> = ({ summary }) => {
    const [open, setOpen] = useState(false);
    return (
        <div className="rounded-md border border-gray-200 bg-white">
            <button
                type="button"
                onClick={() => setOpen(!open)}
                className="w-full flex items-center gap-2 p-3 text-left font-semibold hover:bg-gray-50"
            >
                {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                Supply Chain
            </button>
            {open && (
                <div className="grid md:grid-cols-2 gap-6 p-4 border-t border-gray-200">
                    <div>
                        <h4 className="text-sm font-semibold mb-2">Dependencies</h4>
                        <Row label="Direct" value={summary.direct_deps} />
                        <Row label="Dev" value={summary.dev_deps} />
                        <Row label="Transitive (total)" value={summary.transitive_deps_total} />
                        <Row label="Lockfile present" value={String(summary.lockfile_present)} />
                        <Row label="Lockfile tracked" value={String(summary.lockfile_tracked)} />
                    </div>
                    <div>
                        <h4 className="text-sm font-semibold mb-2">CVEs</h4>
                        <Row label="Critical" value={summary.critical_cves} />
                        <Row label="High" value={summary.high_cves} />
                        <Row label="Moderate" value={summary.moderate_cves} />
                        <Row label="Low" value={summary.low_cves} />
                        <Row label="Install scripts" value={summary.install_scripts_in_prod_deps} />
                    </div>
                </div>
            )}
        </div>
    );
};

export default SupplyChainPanel;
