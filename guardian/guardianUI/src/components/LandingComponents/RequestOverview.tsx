import { Paper, styled } from '@mui/material';
import { useDrawingArea } from '@mui/x-charts';
import { PieChart } from '@mui/x-charts/PieChart';

const StyledText = styled('text')(({ theme }) => ({
    fill: theme.palette.text.primary,
    textAnchor: 'middle',
    dominantBaseline: 'central',
    fontSize: 20,
  }));
  
function PieCenterLabel({ children }: { children: React.ReactNode }) {
    const { width, height, left, top } = useDrawingArea();
    return (
      <StyledText x={left + width / 2} y={top + height / 2}>
        {children}
      </StyledText>
    );
  }
export default function RequestOverview() {
    return (
        
        <PieChart
        margin={{ top: 10, bottom: 50 }}
        title="45"
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
        height={300}>
            <PieCenterLabel>45</PieCenterLabel>
        </PieChart>
        
);
}
