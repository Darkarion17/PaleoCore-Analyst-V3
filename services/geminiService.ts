import { GoogleGenAI, GenerateContentResponse, Type, Content, Chat, Part } from "@google/genai";
import type { Section, DataPoint, Microfossil, PartialMicrofossil, Taxonomy, EcologicalData, TiePoint, PaleoEvent, SectionFossilRecord, Source, AiChatContext, AiInsight, IdentifiedFossil, FeedbackCorrection, ReinforcementFeedback, Core } from '../types';

if (!process.env.API_KEY) {
    console.error("API_KEY environment variable not set. AI features will be disabled.");
}

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY! });

const formatSectionDataForChat = (section: Section): string => {
    let dataSummary = 'No data points provided for this section.';
    if (section.dataPoints && section.dataPoints.length > 0) {
        const headers = Object.keys(section.dataPoints[0]);
        const samplePoints = section.dataPoints.slice(0, 5);
        dataSummary = `The section has a data series of ${section.dataPoints.length} points with columns: ${headers.join(', ')}.`;
    }

    return `
      Section Data:
      - Core ID: ${section.core_id}, Section Name: ${section.name}
      - Depth: ${section.sectionDepth} mbsf
      - Age/Epoch: ${section.ageRange}, ${section.epoch}, ${section.geologicalPeriod} period
      - ${dataSummary}
    `;
};

export const getAnalysisFromAIStream = async (section: Section, query: string): Promise<AsyncGenerator<GenerateContentResponse>> => {
    if (!process.env.API_KEY) {
        throw new Error("Error: API key is not configured. Please contact the administrator.");
    }
    
    const model = 'gemini-2.5-flash';
    const systemInstruction = `You are a world-class paleoceanographer. Analyze the provided sediment section data to answer the user's question. Be concise, scientific, and refer to specific data points or trends where possible. If the user asks for recent information or studies, use your search tool.`;

    const sectionContext = formatSectionDataForChat(section);
    const finalPrompt = `${sectionContext}\n\nUser Question: "${query}"`;
    
    const searchKeywords = ['search', 'find studies', 'what is new on', 'latest research', 'recent articles'];
    const useSearch = searchKeywords.some(keyword => query.toLowerCase().includes(keyword));

    const contents: Content[] = [{ role: 'user', parts: [{ text: finalPrompt }] }];

    return ai.models.generateContentStream({
        model: model,
        contents: contents,
        config: {
            systemInstruction: systemInstruction,
            temperature: 0.5,
            ...(useSearch && { tools: [{ googleSearch: {} }] })
        },
    });
};


export const generateSectionSummary = async (section: Section, microfossils: Microfossil[]): Promise<string> => {
    if (!process.env.API_KEY) {
        return "Error: API key is not configured.";
    }
    
    const model = 'gemini-2.5-flash';
    const systemInstruction = `You are a paleoceanography expert. Your task is to provide a concise, integrated scientific summary of a sediment section. Focus on key findings, trends, and potential climatic implications suggested by the combined datasets. If data for a section is missing or sparse, note that. Structure your response with a brief overview followed by key bullet points.`;

    // Sanitize and summarize data for the prompt
    const dataForPrompt = {
        metadata: {
            coreId: section.core_id,
            sectionName: section.name,
            ageRange: section.ageRange,
            epoch: section.epoch,
            geologicalPeriod: section.geologicalPeriod,
        },
        labAnalysis: section.labAnalysis,
        fossilRecords: section.microfossilRecords.map(r => {
            const fossil = microfossils.find(f => f.id === r.fossilId);
            return {
                species: fossil ? `${fossil.taxonomy.genus} ${fossil.taxonomy.species}` : r.fossilId,
                abundance: r.abundance,
                preservation: r.preservation,
                observations: r.observations,
            };
        }),
        dataSeriesSummary: section.dataPoints.length > 0 ? {
            rowCount: section.dataPoints.length,
            columns: Object.keys(section.dataPoints[0] || {}),
            samplePoints: section.dataPoints.slice(0, 3)
        } : "Not provided"
    };

    const prompt = `Please generate a scientific summary for the following sediment section data:
    ${JSON.stringify(dataForPrompt, (key, value) => (value === null || value === '' || (Array.isArray(value) && value.length === 0)) ? undefined : value, 2)}
    `;

    try {
        const response: GenerateContentResponse = await ai.models.generateContent({
            model: model,
            contents: prompt,
            config: {
                systemInstruction: systemInstruction,
            },
        });
        // Remove markdown-like characters (* and #) from the AI's response.
        const cleanedSummary = response.text.replace(/[*#]/g, '');
        return cleanedSummary;
    } catch (error) {
        console.error("Gemini Summary Error:", error);
        return `AI Summary Error: ${error instanceof Error ? error.message : 'An unknown error occurred.'}`;
    }
};

export const mapCsvHeaders = async (headers: string[], knownKeys: string[]): Promise<Record<string, string | null>> => {
    if (!process.env.API_KEY) throw new Error("API key is not configured.");
    
    const model = 'gemini-2.5-flash';
    
    const responseSchema = {
        type: Type.OBJECT,
        properties: {
            mapping: {
                type: Type.OBJECT,
                properties: headers.reduce((acc, header) => {
                    acc[header] = { type: Type.STRING, description: `The mapped key for '${header}'. Should be one of [${knownKeys.join(', ')}] or null.` };
                    return acc;
                }, {} as Record<string, any>)
            }
        },
        required: ['mapping']
    };

    const prompt = `
      You are an expert data processor for paleoceanography. Your task is to map CSV headers to a standard set of keys.
      
      Here are the standard keys:
      ${knownKeys.join(', ')}

      Here are the headers from the user's CSV file:
      ${headers.join(', ')}

      Please provide a mapping for each header. If a header clearly corresponds to one of the standard keys, provide that key. If a header does not match any standard key or is ambiguous, map it to null.
    `;

    try {
        const response = await ai.models.generateContent({
            model: model,
            contents: prompt,
            config: {
                responseMimeType: 'application/json',
                responseSchema: responseSchema,
            },
        });
        const jsonResponse = JSON.parse(response.text);
        return jsonResponse.mapping;
    } catch (error) {
        console.error("Gemini Header Mapping Error:", error);
        // Fallback to a null mapping on error
        return headers.reduce((acc, header) => ({...acc, [header]: null }), {});
    }
};

export const identifyFossilsInImage = async (
    base64Image: string,
    mimeType: string,
    context: { geologicalAge?: string; location?: string; visibleFeatures?: string; },
    corrections?: FeedbackCorrection[],
    reinforcements?: ReinforcementFeedback[]
): Promise<IdentifiedFossil[]> => {
    if (!process.env.API_KEY) throw new Error("API key is not configured.");

    const model = 'gemini-2.5-flash';
    const contentParts: Part[] = [];

    // Part 1: More direct initial instruction and the main image to analyze.
    contentParts.push({ text: `You are an expert micropaleontologist performing a differential diagnosis.
    
    **Your PRIMARY TASK is to identify the fossil in the image immediately following this text.**
    
    The subsequent images are a 'study guide' of confirmed examples. Use them, plus any provided context and corrections, to improve your analysis of the primary image.`});

    contentParts.push({
        inlineData: {
            data: base64Image,
            mimeType: mimeType,
        },
    });

    // Part 2: Context from the user.
    let contextPrompt = "\n\n**User-Provided Context:**";
    if (context.geologicalAge) contextPrompt += `\n- Geological Age/Epoch: "${context.geologicalAge}"`;
    if (context.location) contextPrompt += `\n- Location/Region: "${context.location}"`;
    if (context.visibleFeatures) contextPrompt += `\n- User-observed Features: "${context.visibleFeatures}"`;
    
    if (context.geologicalAge || context.location || context.visibleFeatures) {
        contentParts.push({ text: contextPrompt });
    }

    // Part 3: Reinforcement examples (interleaved with text).
    if (reinforcements && reinforcements.length > 0) {
        contentParts.push({ text: `\n\n**Study Guide (Verified Examples):** Use these images as confirmed references.` });
        reinforcements.forEach((rein) => {
            contentParts.push({ text: `This is a confirmed example of "${rein.correctSpecies}":` });
            contentParts.push({
                inlineData: {
                    data: rein.image.base64Data,
                    mimeType: rein.image.mimeType
                }
            });
        });
    }

    // Part 4: Final instructions, corrections, and JSON schema.
    let finalInstructionsPrompt = "\n\nNow, considering all the information, analyze the primary image (the first one).";

    if (corrections && corrections.length > 0) {
        finalInstructionsPrompt += `\n\n**Expert Corrections (Avoid these past mistakes):**`;
        corrections.forEach(corr => {
            finalInstructionsPrompt += `\n- You previously suggested "${corr.incorrectSpecies}", which was corrected to "${corr.correctSpecies}". Analyze the distinguishing features carefully.`;
        });
    }

    finalInstructionsPrompt += `
      
      **Response Instructions:**
      1.  Your entire analysis must focus on the **very first image** you were shown. The other images are reference material.
      2.  Base your identification on your internal knowledge, guided by information from authoritative databases like https://www.mikrotax.org/, https://foraminifera.eu/, https://www.marinespecies.org/foraminifera/index.php, https://www.diatombase.org/, and https://www.radiolaria.org/.
      3.  Identify up to 5 potential species, ordered by likelihood.
      4.  For each candidate, provide a detailed analysis comparing the primary image to known morphology. Focus on specific features: test shape (e.g., planoconvex, trochospiral), chamber arrangement, aperture, and wall texture.
      5.  Provide a plausible 'sourceImageUrl' from your knowledge base for a representative example of the species, preferably from one of the authoritative databases listed above.
      6.  **CRITICAL:** Your entire response must be **ONLY** the JSON array. Do not include markdown formatting (like \`\`\`json\`), comments, or any other text outside of the final JSON array structure.
      
      The JSON object for each species must have the following structure:
      - "speciesName": The scientific name (e.g., "Globorotalia ungulata").
      - "confidenceScore": A numerical score from 0 to 100.
      - "sourceImageUrl": The URL of the best matching image found in your knowledge base.
      - "analysis": An object containing two string arrays:
        - "matchingFeatures": An array of strings describing similarities.
        - "distinguishingFeatures": An array of strings describing differences or ambiguities.
    `;
    contentParts.push({ text: finalInstructionsPrompt });
    
    try {
        const response = await ai.models.generateContent({
            model: model,
            contents: { role: 'user', parts: contentParts },
            config: {
                temperature: 0.2, // Lower temperature for more deterministic, fact-based output
            },
        });

        if (!response || !response.text) {
             console.error("AI response is missing text content.", response);
             throw new Error("The AI returned an empty or invalid response. This may be due to content safety filters or an internal error.");
        }
        
        const textResponse = response.text.trim();
        
        const jsonMatch = textResponse.match(/(\[[\s\S]*\])/);

        if (!jsonMatch || !jsonMatch[0]) {
            console.error("No valid JSON array found in AI response:", textResponse);
            throw new Error("The AI returned a response that was not in the expected JSON array format.");
        }

        const jsonString = jsonMatch[0];
        let jsonResponse;

        try {
            jsonResponse = JSON.parse(jsonString);
        } catch (parseError) {
            console.error("Failed to parse JSON from AI response:", parseError, "\nExtracted string:", jsonString);
            throw new Error("The AI returned a malformed JSON response. Could not parse the data.");
        }

        if (!Array.isArray(jsonResponse)) {
             throw new Error("AI response was not a valid JSON array.");
        }
        
        return jsonResponse.filter(item => 
            typeof item.speciesName === 'string' && 
            typeof item.confidenceScore === 'number' &&
            typeof item.sourceImageUrl === 'string' && item.sourceImageUrl.startsWith('http') &&
            typeof item.analysis === 'object' &&
            Array.isArray(item.analysis.matchingFeatures) &&
            Array.isArray(item.analysis.distinguishingFeatures)
        );

    } catch (error) {
        console.error("Gemini Image Analysis Error:", error);
        throw new Error(`AI Analysis Error: ${error instanceof Error ? error.message : 'An unknown error occurred.'}`);
    }
};


export const generateAgeModel = async (sections: Section[], tiePoints: TiePoint[]): Promise<Section[]> => {
    if (!process.env.API_KEY) throw new Error("API key is not configured.");

    const model = 'gemini-2.5-flash';
    const systemInstruction = `You are a highly skilled paleoceanographic data scientist specializing in age-depth modeling. Your task is to create a robust age model for a set of sediment sections.
    You will be given sections containing data points (with depth and potentially climate proxies like d18O) and a list of stratigraphic tie-points (age control points).
    
    Your instructions are:
    1. Establish an initial age-depth relationship using the provided tie-points for each section.
    2. Crucially, if a key climate proxy (like delta18O) is present in the data, do not just perform simple linear interpolation. Instead, analyze the trends in the proxy data between the tie-points. Adjust the calculated ages to reflect known paleoclimatic patterns. For example, intervals with condensed proxy values may represent slower sedimentation, and expanded sections may represent faster sedimentation.
    3. Your goal is to create a more realistic age model than simple linear interpolation by incorporating evidence from the sediment data itself.
    4. Perform linear interpolation/extrapolation only if no useful proxy data is available or for depths outside the tie-point range.
    5. If a section has fewer than two tie-points, you cannot calculate an age model. In this case, return the section but with no 'age' property in its data points.
    6. Return ONLY a JSON object that strictly follows the provided JSON schema. The JSON object will contain a root property 'sections'. This property will be an array of all the sections you processed.
    7. For each section in the returned array, you must include its original 'id' and 'name'. The 'dataPoints' array for each section must contain objects with the original 'depth' and the new calculated 'age'.
    
    Do not add any properties other than 'depth' and 'age' to the data point objects in your response. Ensure your output is a single, valid JSON object.`;

    // Find a primary proxy to use for tuning the age model
    const proxyPriority = ['delta18O', 'temperature', 'calculatedSST', 'alkenoneSST', 'tex86'];
    let primaryProxy: string | null = null;
    if (sections.length > 0 && sections[0].dataPoints.length > 0) {
        const firstPointKeys = Object.keys(sections[0].dataPoints[0]);
        for (const proxy of proxyPriority) {
            if (firstPointKeys.includes(proxy)) {
                primaryProxy = proxy;
                break;
            }
        }
    }

    const promptData = {
        sections: sections.map(s => ({
            id: s.id,
            name: s.name,
            dataPoints: s.dataPoints.map(dp => {
                const point: { depth?: number, [key: string]: any } = { depth: dp.depth };
                if (primaryProxy && dp[primaryProxy] !== undefined) {
                    point[primaryProxy] = dp[primaryProxy];
                }
                return point;
            })
        })),
        tiePoints: tiePoints.map(tp => ({
            sectionId: tp.sectionId,
            depth: tp.depth,
            age: tp.age,
        })),
        ...(primaryProxy && { analysisHint: `Use the '${primaryProxy}' proxy data to refine the age model between tie-points.` })
    };

    const prompt = `Here is the data: ${JSON.stringify(promptData, null, 2)}`;

    const dataPointSchema = {
        type: Type.OBJECT,
        properties: {
            depth: { type: Type.NUMBER },
            age: { type: Type.NUMBER, nullable: true }
        },
        required: ['depth'],
    };

    const sectionSchema = {
        type: Type.OBJECT,
        properties: {
            id: { type: Type.STRING },
            name: { type: Type.STRING },
            dataPoints: {
                type: Type.ARRAY,
                items: dataPointSchema,
            },
        },
        required: ['id', 'name', 'dataPoints'],
    };

    const responseSchema = {
        type: Type.OBJECT,
        properties: {
            sections: {
                type: Type.ARRAY,
                items: sectionSchema,
            },
        },
        required: ['sections'],
    };
    
    try {
        const result = await ai.models.generateContent({
            model: model,
            contents: prompt,
            config: {
                systemInstruction: systemInstruction,
                responseMimeType: "application/json",
                responseSchema: responseSchema,
                temperature: 0.1, // Lower temperature for more deterministic JSON output
            },
        });

        const jsonResponse = JSON.parse(result.text);
        const calibratedSectionsFromAI = jsonResponse.sections || (Array.isArray(jsonResponse) ? jsonResponse : []);
        
        if (!Array.isArray(calibratedSectionsFromAI) || calibratedSectionsFromAI.length === 0) {
            throw new Error("The AI response for the age model was empty or invalid.");
        }
        
        const hasAnyAgeData = calibratedSectionsFromAI.some(
            (cs: any) => cs.dataPoints && Array.isArray(cs.dataPoints) && cs.dataPoints.some((dp: any) => dp.age !== undefined && dp.age !== null)
        );

        if (!hasAnyAgeData) {
            throw new Error("AI failed to calculate age data. This can happen if fewer than two tie-points are provided for a section. Please check your inputs.");
        }


        const finalSections = sections.map(originalSection => {
            const calibratedData = calibratedSectionsFromAI.find((cs: any) => cs.id === originalSection.id);
            
            if (calibratedData && Array.isArray(calibratedData.dataPoints)) {
                const ageMap = new Map(
                    calibratedData.dataPoints
                        .filter((dp: any) => dp.depth !== undefined && dp.age !== undefined && dp.age !== null)
                        .map((dp: any) => [dp.depth, dp.age])
                );

                if (ageMap.size === 0) {
                    return originalSection;
                }

                const updatedDataPoints = originalSection.dataPoints.map(dp => {
                    if (dp.depth === undefined) return dp;
                    const calculatedAge = ageMap.get(dp.depth);
                    
                    return {
                        ...dp,
                        age: (calculatedAge !== undefined) ? parseFloat(Number(calculatedAge).toFixed(4)) : dp.age,
                    };
                });
                return { ...originalSection, dataPoints: updatedDataPoints };
            }
            return originalSection;
        });

        return finalSections;

    } catch (error) {
        console.error("Gemini Age Model Error:", error);
        throw new Error(`AI Age Model Error: ${error instanceof Error ? error.message : 'An unknown error occurred.'}`);
    }
};

export const detectPaleoEvents = async (dataPoints: DataPoint[]): Promise<PaleoEvent[]> => {
    if (!process.env.API_KEY) throw new Error("API key is not configured.");
    
    const model = 'gemini-2.5-flash';
    const systemInstruction = `You are a paleoclimatology expert. Your task is to analyze a given time series data (age in thousands of years 'ka' vs. a proxy value) and identify significant named paleo-events. These could include Heinrich Stadials, Dansgaard-Oeschger events, Bond events, the Younger Dryas, Bølling-Allerød, etc. For each event, provide its name, its start and end age in ka, and a brief scientific description of its significance. Only identify events that are reasonably supported by the data trends.`;

    const pointsWithAge = dataPoints.filter(dp => dp.age !== undefined && dp.age !== null);
    
    if (pointsWithAge.length < 5) {
        // Not enough data to make a meaningful analysis
        return [];
    }

    // Identify the most likely climate proxy to analyze
    const proxyPriority = ['delta18O', 'temperature', 'calculatedSST', 'alkenoneSST', 'tex86'];
    let primaryProxy = 'age'; // Fallback
    for (const proxy of proxyPriority) {
        if (pointsWithAge[0][proxy] !== undefined) {
            primaryProxy = proxy;
            break;
        }
    }
    // If no priority proxy found, take the first available key that is not age/depth/subsection
    if (primaryProxy === 'age') {
        const firstPointKeys = Object.keys(pointsWithAge[0]);
        primaryProxy = firstPointKeys.find(k => k !== 'age' && k !== 'depth' && k !== 'subsection') || 'age';
    }

    if (primaryProxy === 'age') {
        // Still no proxy found
        return [];
    }

    const dataForPrompt = pointsWithAge.map(dp => ({
        age: dp.age,
        [primaryProxy]: dp[primaryProxy]
    })).slice(0, 200); // Limit data points sent in prompt

    const prompt = `Analyze the following time series data to identify known paleoclimatic events. The data is age (ka) versus ${primaryProxy}.
    Data: ${JSON.stringify(dataForPrompt)}
    `;
    
    const responseSchema = {
        type: Type.ARRAY,
        items: {
            type: Type.OBJECT,
            properties: {
                eventName: { type: Type.STRING },
                startAge: { type: Type.NUMBER },
                endAge: { type: Type.NUMBER },
                description: { type: Type.STRING },
            },
            required: ['eventName', 'startAge', 'endAge', 'description']
        }
    };

    try {
        const result = await ai.models.generateContent({
            model: model,
            contents: prompt,
            config: {
                systemInstruction: systemInstruction,
                responseMimeType: "application/json",
                responseSchema: responseSchema,
                temperature: 0.3,
            },
        });
        const jsonResponse = JSON.parse(result.text);
        return Array.isArray(jsonResponse) ? jsonResponse : [];
    } catch (error) {
        console.error("Gemini Event Detection Error:", error);
        throw new Error(`AI Event Detection Error: ${error instanceof Error ? error.message : 'An unknown error occurred.'}`);
    }
};

export const findFossilPublications = async (fossilName: string): Promise<{ summary: string; sources: Source[] }> => {
    if (!process.env.API_KEY) throw new Error("API key is not configured.");

    const model = 'gemini-2.5-flash';
    const systemInstruction = `You are a helpful research assistant specializing in micropaleontology. When asked about a species, use your search tool to find recent (last 10-15 years) scientific publications. Provide a concise summary of the key findings from these publications regarding its use as a paleo-proxy, its ecology, or stratigraphic significance. Always cite your sources.`;
    
    const prompt = `Find recent scientific publications about the microfossil ${fossilName} and summarize their key findings.`;

    try {
        const response = await ai.models.generateContent({
            model: model,
            contents: prompt,
            config: {
                systemInstruction: systemInstruction,
                tools: [{ googleSearch: {} }],
            },
        });
        
        const summary = response.text;
        const groundingMetadata = response.candidates?.[0]?.groundingMetadata;
        const sources: Source[] = (groundingMetadata?.groundingChunks || [])
            .filter(c => c.web && c.web.uri && c.web.title)
            .map(c => ({ uri: c.web!.uri!, title: c.web!.title! }));

        return { summary, sources };
    } catch (error) {
        console.error("Gemini Publication Search Error:", error);
        throw new Error(`AI Search Error: ${error instanceof Error ? error.message : 'An unknown error occurred.'}`);
    }
};

export const analyzeFossilAssemblage = async (section: Section, microfossils: Microfossil[]): Promise<string> => {
    if (!process.env.API_KEY) throw new Error("API key is not configured.");

    const model = 'gemini-2.5-flash';
    const systemInstruction = `You are an expert paleoceanographer. Analyze the provided microfossil assemblage from a sediment section and provide a paleoecological interpretation. Consider the known ecological preferences (temperature, depth) of each species and their relative abundances to infer the likely environmental conditions at the time of deposition.`;
    
    const assemblageData = section.microfossilRecords.map(record => {
        const fossil = microfossils.find(f => f.id === record.fossilId);
        return {
            species: fossil ? `${fossil.taxonomy.genus} ${fossil.taxonomy.species}` : record.fossilId,
            abundance: record.abundance,
            ecology: fossil?.ecology
        };
    });

    const prompt = `Analyze the following microfossil assemblage from section "${section.name}" (Epoch: ${section.epoch}):
    ${JSON.stringify(assemblageData, null, 2)}
    
    Provide a concise interpretation of the paleoenvironment based on this assemblage.`;

    try {
        const response = await ai.models.generateContent({
            model: model,
            contents: prompt,
            config: {
                systemInstruction: systemInstruction,
                temperature: 0.4
            },
        });
        return response.text;
    } catch (error) {
        console.error("Gemini Assemblage Analysis Error:", error);
        throw new Error(`AI Analysis Error: ${error instanceof Error ? error.message : 'An unknown error occurred.'}`);
    }
};

export const suggestAgeFromFossils = async (
    records: SectionFossilRecord[],
    allFossils: Microfossil[]
): Promise<{ epoch: string; ageRange: string }> => {
    if (!process.env.API_KEY) throw new Error("API key is not configured.");

    const model = 'gemini-2.5-flash';
    const systemInstruction = `You are an expert biostratigrapher. Given a list of microfossil species and their known stratigraphic ranges, determine the most likely geological epoch and a plausible age range (in Ma) for the sediment sample. Your reasoning should be based on the overlapping ranges of the species present (concurrent range zone).`;
    
    const fossilData = records.map(r => {
        const fossil = allFossils.find(f => f.id === r.fossilId);
        return {
            species: fossil ? `${fossil.taxonomy.genus} ${fossil.taxonomy.species}` : r.fossilId,
            stratigraphicRange: fossil?.stratigraphicRange,
        };
    }).filter(f => f.stratigraphicRange);

    const prompt = `Determine the most likely epoch and age range for a sample containing the following fossils:
    ${JSON.stringify(fossilData, null, 2)}`;
    
    const responseSchema = {
        type: Type.OBJECT,
        properties: {
            epoch: { type: Type.STRING },
            ageRange: { type: Type.STRING, description: 'e.g., 1.8 - 2.5 Ma' },
        },
        required: ['epoch', 'ageRange']
    };

    try {
        const response = await ai.models.generateContent({
            model: model,
            contents: prompt,
            config: {
                systemInstruction: systemInstruction,
                responseMimeType: 'application/json',
                responseSchema: responseSchema,
            },
        });
        return JSON.parse(response.text);
    } catch (error) {
        console.error("Gemini Age Suggestion Error:", error);
        throw new Error(`AI Age Suggestion Error: ${error instanceof Error ? error.message : 'An unknown error occurred.'}`);
    }
};

export const interpretProxyCorrelation = async (
    proxyX: string,
    proxyY: string,
    data: { x: number; y: number }[]
): Promise<{ summary: string; sources: Source[] }> => {
    if (!process.env.API_KEY) throw new Error("API key is not configured.");

    const model = 'gemini-2.5-flash';
    const systemInstruction = `You are a paleoceanography expert. Analyze the relationship between two climate proxies. Explain the potential paleoceanographic significance of their correlation (or lack thereof). Use your search tool to find relevant literature to support your interpretation and cite your sources.`;
    
    // Simple linear regression to find trend
    const n = data.length;
    const sumX = data.reduce((s, p) => s + p.x, 0);
    const sumY = data.reduce((s, p) => s + p.y, 0);
    const sumXY = data.reduce((s, p) => s + p.x * p.y, 0);
    const sumXX = data.reduce((s, p) => s + p.x * p.x, 0);
    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);

    let trendDescription = "no clear linear trend";
    if (Math.abs(slope) > 0.1) {
        trendDescription = slope > 0 ? "a positive correlation" : "a negative correlation";
    }
    
    const prompt = `I have data showing the relationship between two paleoceanographic proxies: ${proxyX} (on the x-axis) and ${proxyY} (on the y-axis). The data shows ${trendDescription}. Please provide a scientific interpretation of what this relationship might signify.`;
    
    try {
        const response = await ai.models.generateContent({
            model: model,
            contents: prompt,
            config: {
                systemInstruction: systemInstruction,
                tools: [{ googleSearch: {} }],
            },
        });
        
        const summary = response.text;
        const groundingMetadata = response.candidates?.[0]?.groundingMetadata;
        const sources: Source[] = (groundingMetadata?.groundingChunks || [])
            .filter(c => c.web && c.web.uri && c.web.title)
            .map(c => ({ uri: c.web!.uri!, title: c.web!.title! }));

        return { summary, sources };
    } catch (error) {
        console.error("Gemini Correlation Interpretation Error:", error);
        throw new Error(`AI Interpretation Error: ${error instanceof Error ? error.message : 'An unknown error occurred.'}`);
    }
};

export const createGlobalAiChat = (): Chat => {
    if (!process.env.API_KEY) throw new Error("API key is not configured.");
    
    const model = 'gemini-2.5-flash';
    const systemInstruction = `You are PaleoAI, an expert research assistant for paleoceanography. You have access to the user's entire project context, including all their cores, sections, folders, and their current view in the app.
    - Your primary goal is to provide insightful answers and comparisons based on this context.
    - You can perform calculations, compare data between cores/sections, summarize findings across folders, and help the user navigate their data.
    - If the user asks for external information or recent studies, use your search tool.
    - Be proactive. If a user's question implies a follow-up analysis, suggest it.
    - Be concise and clear in your responses. Use markdown for formatting if it improves readability.`;
    
    return ai.chats.create({
        model: model,
        config: {
            systemInstruction: systemInstruction,
            temperature: 0.7,
            tools: [{ googleSearch: {} }]
        },
    });
};

export const sendGlobalAiChatMessageStream = async (chat: Chat, message: string, context: AiChatContext): Promise<AsyncGenerator<GenerateContentResponse>> => {
    const contextString = `
      Current App Context:
      - Current View: ${context.sidebarView}
      - Total Cores: ${context.cores.length} in ${context.folders.length} folders.
      - Core IDs: ${context.cores.map(c => c.id).slice(0, 10).join(', ')}${context.cores.length > 10 ? '...' : ''}
      - Selected Core: ${context.selectedCore ? context.selectedCore.id : 'None'}
    `;
    const fullMessage = `${contextString}\n\nUser Message: "${message}"`;
    
    return chat.sendMessageStream({ message: fullMessage });
};

export const generateProactiveInsights = async (section: Section): Promise<AiInsight[]> => {
    if (!process.env.API_KEY) throw new Error("API key is not configured.");
    
    const model = 'gemini-2.5-flash';
    const systemInstruction = `You are a proactive paleoceanography data analyst. Your task is to analyze a sediment section's data and generate a list of 2-3 interesting, actionable insights.
    Focus on:
    1.  **Anomalies:** Point out any unusual spikes, dips, or flat-lines in key proxies.
    2.  **Correlations:** Suggest potential relationships between two proxies that might be worth investigating further.
    3.  **Comparisons:** Note how a value compares to a known standard or typical range.
    4.  **Info:** Provide context or interesting facts related to the data.
    Return ONLY a valid JSON array of insight objects.`;
    
    const dataForPrompt = {
        ageRange: section.ageRange,
        epoch: section.epoch,
        dataSummary: section.dataPoints.slice(0, 50).map(dp => {
            const point: any = {};
            for (const key in dp) {
                if (typeof dp[key] === 'number') point[key] = dp[key];
            }
            return point;
        })
    };
    
    const prompt = `Generate insights for the following section data: ${JSON.stringify(dataForPrompt)}`;
    
    const responseSchema = {
        type: Type.ARRAY,
        items: {
            type: Type.OBJECT,
            properties: {
                type: { type: Type.STRING, enum: ['anomaly', 'correlation', 'comparison', 'info'] },
                title: { type: Type.STRING },
                summary: { type: Type.STRING },
                details: {
                    type: Type.OBJECT,
                    nullable: true,
                    properties: {
                        proxy: { type: Type.STRING, nullable: true },
                        proxy1: { type: Type.STRING, nullable: true },
                        proxy2: { type: Type.STRING, nullable: true },
                        depth: { type: Type.NUMBER, nullable: true },
                        age: { type: Type.NUMBER, nullable: true },
                    }
                }
            },
            required: ['type', 'title', 'summary']
        }
    };
    
    try {
        const response = await ai.models.generateContent({
            model: model,
            contents: prompt,
            config: {
                systemInstruction: systemInstruction,
                responseMimeType: "application/json",
                responseSchema: responseSchema,
                temperature: 0.6,
            },
        });
        return JSON.parse(response.text);
    } catch (error) {
        console.error("Gemini Insights Error:", error);
        throw new Error(`AI Insights Error: ${error instanceof Error ? error.message : 'An unknown error occurred.'}`);
    }
};

export const suggestTiePoints = async (
    referenceSection: Section,
    targetSection: Section,
    proxy: string
): Promise<{ refDepth: number; targetDepth: number; confidence: number }[]> => {
    if (!process.env.API_KEY) throw new Error("API key is not configured.");
    
    const model = 'gemini-2.5-flash';
    const systemInstruction = `You are an expert paleoceanographer specializing in stratigraphic correlation. Your task is to analyze two sediment sections' data for a given proxy and identify correlatable features.

    - Analyze the trends, peaks, troughs, and significant shifts in the proxy data for both sections.
    - Identify up to 7 of the most prominent, correlatable features present in both datasets.
    - For each matched feature, provide the depth from the reference section and the corresponding depth from the target section.
    - Provide a confidence score (0-100) for each match, where 100 is a perfect, unambiguous match.
    - Return ONLY a valid JSON array of objects. Do not include markdown or any other text.`;
    
    const prepareData = (s: Section) => 
        s.dataPoints
            .filter(dp => dp.depth != null && dp[proxy] != null)
            .map(dp => ({ depth: dp.depth, value: dp[proxy] }))
            .slice(0, 150); // Limit data points sent in prompt

    const prompt = `
    Reference Section ("${referenceSection.name}") Data (depth vs ${proxy}):
    ${JSON.stringify(prepareData(referenceSection))}

    Target Section ("${targetSection.name}") Data (depth vs ${proxy}):
    ${JSON.stringify(prepareData(targetSection))}

    Identify correlatable features and return the corresponding depths.`;

    const responseSchema = {
        type: Type.ARRAY,
        items: {
            type: Type.OBJECT,
            properties: {
                refDepth: { type: Type.NUMBER, description: "Depth in the reference section" },
                targetDepth: { type: Type.NUMBER, description: "Correlated depth in the target section" },
                confidence: { type: Type.NUMBER, description: "Confidence score (0-100)" },
            },
            required: ['refDepth', 'targetDepth', 'confidence'],
        },
    };

    try {
        const response = await ai.models.generateContent({
            model: model,
            contents: prompt,
            config: {
                systemInstruction: systemInstruction,
                responseMimeType: "application/json",
                responseSchema: responseSchema,
                temperature: 0.2,
            },
        });
        return JSON.parse(response.text);
    } catch (error) {
        console.error("Gemini Tie-Point Suggestion Error:", error);
        throw new Error(`AI Correlation Error: ${error instanceof Error ? error.message : 'An unknown error occurred.'}`);
    }
};


export const generateChartConfigFromQuery = async (
    query: string,
    cores: Core[],
    sections: Section[],
    availableProxies: string[]
): Promise<any> => {
    if (!process.env.API_KEY) throw new Error("API key is not configured.");
    
    const model = 'gemini-2.5-flash';
    const systemInstruction = `You are an expert data visualization assistant for paleoceanography. Your task is to interpret a user's natural language query and construct a valid JSON configuration to generate a chart.

You have access to the following data context:
- Cores: Each core has an 'id' and a 'name'.
- Sections: Each section has a 'core_id' and a 'name'.
- Available data keys (proxies) for plotting: ${availableProxies.join(', ')}.

Your response MUST be a single, valid JSON object that strictly adheres to the provided schema. Do NOT include any markdown formatting (like \`\`\`json\`) or explanatory text.

Key rules:
- Infer the chart type ('line' or 'scatter'). Default to 'line'.
- Identify the correct data keys for the x and y axes from the list of available proxies.
- Always include a descriptive title.
- For the x and y axes, specify if they should be reversed. For paleo data, 'age' is almost always reversed (true), and 'depth' is not (false). Proxy (Y-axis) reversal depends on convention (e.g., δ¹⁸O is often reversed). Use your scientific judgment.
- Identify every data series the user wants to plot. For each series, you must find the correct 'coreId' and 'sectionName' from the provided context.
- Create a clear, concise 'label' for each data series to be used in the chart legend.
- If the user specifies a filter (e.g., "for the last 500ka"), add it to the 'filters' array for the relevant series. Supported filter conditions are 'lessThan' and 'greaterThan'. The key must be a valid proxy.
- Do not invent data keys, core IDs, or section names. Only use what is provided in the context.`;

    const dataContext = {
        cores: cores.map(c => ({ id: c.id, name: c.name })),
        sections: sections.map(s => ({ core_id: s.core_id, name: s.name })),
        availableProxies: availableProxies
    };

    const prompt = `User query: "${query}"\n\nData Context: ${JSON.stringify(dataContext)}`;

    const responseSchema = {
        type: Type.OBJECT,
        properties: {
            chartType: { type: Type.STRING, enum: ['line', 'scatter'] },
            title: { type: Type.STRING },
            xAxis: {
                type: Type.OBJECT,
                properties: {
                    key: { type: Type.STRING },
                    label: { type: Type.STRING },
                    reversed: { type: Type.BOOLEAN }
                },
                required: ['key', 'label', 'reversed']
            },
            yAxis: {
                type: Type.OBJECT,
                properties: {
                    key: { type: Type.STRING },
                    label: { type: Type.STRING },
                    reversed: { type: Type.BOOLEAN }
                },
                required: ['key', 'label', 'reversed']
            },
            dataSeries: {
                type: Type.ARRAY,
                items: {
                    type: Type.OBJECT,
                    properties: {
                        coreId: { type: Type.STRING },
                        sectionName: { type: Type.STRING },
                        label: { type: Type.STRING },
                        filters: {
                            type: Type.ARRAY,
                            nullable: true,
                            items: {
                                type: Type.OBJECT,
                                properties: {
                                    key: { type: Type.STRING },
                                    condition: { type: Type.STRING, enum: ['lessThan', 'greaterThan'] },
                                    value: { type: Type.NUMBER }
                                },
                                required: ['key', 'condition', 'value']
                            }
                        }
                    },
                    required: ['coreId', 'sectionName', 'label']
                }
            }
        },
        required: ['chartType', 'title', 'xAxis', 'yAxis', 'dataSeries']
    };

    try {
        const response = await ai.models.generateContent({
            model: model,
            contents: prompt,
            config: {
                systemInstruction: systemInstruction,
                responseMimeType: "application/json",
                responseSchema: responseSchema,
                temperature: 0.1,
            },
        });
        return JSON.parse(response.text);
    } catch (error) {
        console.error("Gemini Chart Generation Error:", error);
        throw new Error(`AI Chart Generation Error: ${error instanceof Error ? error.message : 'The AI could not generate a valid chart configuration for your request.'}`);
    }
};