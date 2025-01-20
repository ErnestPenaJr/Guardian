import { Paper } from '@mui/material';
import { PieChart } from '@mui/x-charts/PieChart';

export default function RequestOverview() {
    return (
        
        <PieChart
        margin={{ top: 10, bottom: 50 }}
        series={[
            {
            data: [ { id: 0, value: 10, color: '#05445E', label: 'Complete' },
                { id: 1, value: 15, color: '#189AB4', label: 'In Progress' },
                { id: 2, value: 20, color: '#75E6DA', label: 'Pending' }, ],
             innerRadius: 89,
            // outerRadius: 100,
            // paddingAngle: 5,
             cornerRadius: 5,
            // startAngle: -45,
            // endAngle: 225,
            // cx: 150,
            // cy: 150,
            }
        ]}
        slotProps={{
            legend: {
            direction: 'row',
            position: { vertical: 'bottom', horizontal: 'middle' },
            padding: 5,
            itemMarkWidth: 10,
            itemMarkHeight: 10,
            markGap: 2,
            itemGap: 20,
            },
            
        }}
        width={400}
        height={300}
        />
        
);
}
