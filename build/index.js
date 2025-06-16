import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
const WEATHER_API_BASE = "https://weather.tsukumijima.net/api/forecast";
const USER_AGENT = "weather-app/1.0";
// Helper function for making weather API requests
async function makeWeatherRequest(url) {
    const headers = {
        "User-Agent": USER_AGENT,
        Accept: "application/json",
    };
    try {
        const response = await fetch(url, { headers });
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        return (await response.json());
    }
    catch (error) {
        console.error("Error making weather request:", error);
        return null;
    }
}
// Create server instance
const server = new McpServer({
    name: "weather",
    version: "1.0.0",
});
// Register weather tools
server.tool("get-forecast", "Get weather forecast for a location using region ID", {
    regionId: z.string().describe("Region ID for the location (e.g., 400040 for Kurume, Fukuoka)"),
}, async ({ regionId }) => {
    // Construct the API URL with region ID
    const weatherUrl = `${WEATHER_API_BASE}?city=${regionId}`;
    const weatherData = await makeWeatherRequest(weatherUrl);
    if (!weatherData) {
        return {
            content: [
                {
                    type: "text",
                    text: `Failed to retrieve weather data for region ID: ${regionId}. Please check if the region ID is valid.`,
                },
            ],
        };
    }
    const forecasts = weatherData.forecasts || [];
    if (forecasts.length === 0) {
        return {
            content: [
                {
                    type: "text",
                    text: "No forecast data available for this region.",
                },
            ],
        };
    }
    // Format forecast periods
    const formattedForecast = forecasts.map((forecast) => {
        const parts = [
            `${forecast.dateLabel || "Unknown"}:`,
            `天気: ${forecast.telop || "不明"}`,
        ];
        // Add temperature information
        if (forecast.temperature) {
            const temp = forecast.temperature;
            if (temp.max?.celsius) {
                parts.push(`最高気温: ${temp.max.celsius}℃`);
            }
            if (temp.min?.celsius) {
                parts.push(`最低気温: ${temp.min.celsius}℃`);
            }
        }
        // Add detailed weather information
        if (forecast.detail) {
            if (forecast.detail.weather) {
                parts.push(`詳細: ${forecast.detail.weather}`);
            }
            if (forecast.detail.wind) {
                parts.push(`風: ${forecast.detail.wind}`);
            }
            if (forecast.detail.wave) {
                parts.push(`波: ${forecast.detail.wave}`);
            }
        }
        parts.push("---");
        return parts.join("\n");
    });
    // Create the response text
    const title = weatherData.title || `地域ID ${regionId} の天気予報`;
    const publicTime = weatherData.publicTimeFormatted || weatherData.publicTime || "";
    const description = weatherData.description?.text || "";
    let forecastText = `${title}\n`;
    if (publicTime) {
        forecastText += `発表時刻: ${publicTime}\n`;
    }
    if (description) {
        forecastText += `\n概況:\n${description}\n`;
    }
    forecastText += `\n予報:\n${formattedForecast.join("\n")}`;
    // Add link to JMA if available
    if (weatherData.link) {
        forecastText += `\n詳細情報: ${weatherData.link}`;
    }
    return {
        content: [
            {
                type: "text",
                text: forecastText,
            },
        ],
    };
});
// Start the server
async function main() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error("Weather MCP Server running on stdio");
}
main().catch((error) => {
    console.error("Fatal error in main():", error);
    process.exit(1);
});
