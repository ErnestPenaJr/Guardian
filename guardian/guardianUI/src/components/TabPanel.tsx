import { Box, Typography } from "@mui/material";
export interface TabPanelProps {
    children?: React.ReactNode;
    index: number;
    value: number;
}

export const TabPanel = ({ children, value, index, ...other }: TabPanelProps) =>
    <div
        role="tabpanel"
        hidden={value !== index}
        id={`request-tabs-${index}`}
        aria-labelledby={`request-tab-${index}`}
        {...other}>
        {value === index &&
            <Box sx={{ p: 3 }}>
                <Typography component={'span'}>{children}</Typography>
            </Box>
        }
    </div>