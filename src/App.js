import React, { useState, useEffect, useRef } from 'react';
import { Chart, registerables } from 'chart.js';
import 'chartjs-chart-financial'; 
import 'chartjs-adapter-luxon'; 
import { Box, Container, FormControl, InputLabel, MenuItem, Select, Typography, Paper } from '@mui/material';
import { CandlestickController, CandlestickElement } from 'chartjs-chart-financial'; 

Chart.register(...registerables); // Register the chart components

// Register the financial controller
Chart.register(CandlestickController, CandlestickElement);

// Coin symbols and time intervals
const symbols = {
  ETH: 'ethusdt',
  BNB: 'bnbusdt',
  DOT: 'dotusdt'
};
const intervals = ['1m', '3m', '5m'];

const App = () => {
  const [selectedSymbol, setSelectedSymbol] = useState(symbols.ETH);
  const [selectedInterval, setSelectedInterval] = useState("1m");
  const [chartData, setChartData] = useState({
    ethusdt: [],
    bnbusdt: [],
    dotusdt: []
  });
  const ws = useRef(null);
  const chartRef = useRef(null);
  const chartInstance = useRef(null); 

  // Fetch historical data
  const fetchHistoricalData = async (symbol, interval) => {
    const endTime = Date.now();
    const startTime = endTime - 10 * 60 * 1000;

    try {
      const response = await fetch(`https://api.binance.com/api/v3/klines?symbol=${symbol.toUpperCase()}&interval=${interval}&startTime=${startTime}&endTime=${endTime}&limit=200`);
      const data = await response.json();

      const formattedData = data.map(item => ({
        time: item[0],
        open: parseFloat(item[1]),
        high: parseFloat(item[2]),
        low: parseFloat(item[3]),
        close: parseFloat(item[4]),
      }));

      // Update the chart data with the fetched historical data
      setChartData(prevData => ({
        ...prevData,
        [symbol]: formattedData
      }));
    } catch (error) {
      console.error('Error fetching historical data:', error);
    }
  };

  // WebSocket connection function
  const connectWebSocket = (symbol, interval) => {
    if (ws.current) {
      ws.current.close();
    }

    ws.current = new WebSocket(`wss://stream.binance.com:9443/ws/${symbol}@kline_${interval}`);

    ws.current.onmessage = (event) => {
      const message = JSON.parse(event.data);
      const { t: time, o: open, h: high, l: low, c: close } = message.k;

      const newCandle = {
        time: time,
        open: parseFloat(open),
        high: parseFloat(high),
        low: parseFloat(low),
        close: parseFloat(close)
      };

      // Update chart data for the selected symbol
      setChartData((prevData) => {
        const newData = [...prevData[symbol], newCandle].slice(-200);
        return {
          ...prevData,
          [symbol]: newData
        };
      });
    };

    ws.current.onclose = () => {
      console.log('WebSocket closed');
    };

    ws.current.onerror = (error) => {
      console.error('WebSocket error:', error);
    };
  };

  // Handle coin selection
  const handleCoinChange = (symbol) => {
    setSelectedSymbol(symbol);
    fetchHistoricalData(symbol, selectedInterval); 
    connectWebSocket(symbol, selectedInterval);
  };

  // Handle interval selection
  const handleIntervalChange = (interval) => {
    setSelectedInterval(interval);
    fetchHistoricalData(selectedSymbol, interval); 
    connectWebSocket(selectedSymbol, interval);
  };

  // Generate chart data for rendering
  const generateChartData = (data) => {

    // Filter for the last 20 minutes
    const now = Date.now();
    const filteredData = data.filter(candle => (now - candle.time) <= 20 * 60 * 1000); 

    // Format data for candlestick chart
    return filteredData.map(candle => ({
      x: candle.time, // Pass the numeric timestamp directly
      o: candle.open,
      h: candle.high,
      l: candle.low,
      c: candle.close
    }));
  };

  // Initialize WebSocket on mount
  useEffect(() => {
    fetchHistoricalData(selectedSymbol, selectedInterval); 
    connectWebSocket(selectedSymbol, selectedInterval);

    return () => {
      if (ws.current) {
        ws.current.close(); 
      }
    };
  }, []); 

  // Create candlestick chart
  useEffect(() => {
    // Destroy previous chart instance if it exists
    if (chartInstance.current) {
      chartInstance.current.destroy();
    }

    // Create new chart instance
    if (chartRef.current) {
      const ctx = chartRef.current.getContext('2d');
      chartInstance.current = new Chart(ctx, {
        type: 'candlestick',
        data: {
          datasets: [{
            label: selectedSymbol,
            data: generateChartData(chartData[selectedSymbol]),
            borderColor: '#1E90FF',
            backgroundColor: 'rgba(30, 144, 255, 0.5)',
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false, 
          scales: {
            x: {
              type: 'time',
              time: {
                unit: 'minute',
              },
              title: {
                display: true,
                text: 'Time',
                color: '#555',
                font: {
                  size: 14,
                  weight: 'bold'
                }
              },
              grid: {
                color: '#eee',
              },
            },
            y: {
              title: {
                display: true,
                text: 'Price',
                color: '#555',
                font: {
                  size: 14,
                  weight: 'bold'
                }
              },
              grid: {
                color: '#eee',
              },
            }
          }
        }
      });
    }
  }, [chartData, selectedSymbol]);

  return (
    <Container maxWidth="md" sx={{ bgcolor: '#f5f5f5', padding: 3, borderRadius: 2, boxShadow: 3 }}>
      <Box sx={{ textAlign: 'center', mb: 4 }}>
        <Typography variant="h4" sx={{ fontWeight: 'bold', color: '#1E90FF' }}>
          Binance Market Data
        </Typography>
      </Box>

      {/* Cryptocurrency Selection */}
      <FormControl fullWidth sx={{ mt: 3 }}>
        <InputLabel>Select Cryptocurrency</InputLabel>
        <Select
          value={selectedSymbol}
          onChange={(e) => handleCoinChange(e.target.value)}
          sx={{ bgcolor: '#ffffff', borderRadius: 1 }}
        >
          <MenuItem value={symbols.ETH}>ETH/USDT</MenuItem>
          <MenuItem value={symbols.BNB}>BNB/USDT</MenuItem>
          <MenuItem value={symbols.DOT}>DOT/USDT</MenuItem>
        </Select>
      </FormControl>

      {/* Interval Selection */}
      <FormControl fullWidth sx={{ mt: 3 }}>
        <InputLabel>Select Time Interval</InputLabel>
        <Select
          value={selectedInterval}
          onChange={(e) => handleIntervalChange(e.target.value)}
          sx={{ bgcolor: '#ffffff', borderRadius: 1 }}
        >
          {intervals.map((interval) => (
            <MenuItem key={interval} value={interval}>
              {interval}
            </MenuItem>
          ))}
        </Select>
      </FormControl>

      {/* Chart Visualization */}
      <Paper elevation={3} sx={{ mt: 5, padding: 2, borderRadius: 2, height: '400px', position: 'relative' }}>
        <canvas 
          ref={chartRef} 
          style={{ width: '100%', height: '100%' }} 
        />
      </Paper>
    </Container>
  );
};

export default App;
