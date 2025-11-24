
import React, { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import * as dataService from '../services/dataService';
import { LoadingIndicator } from './LoadingIndicator';
import { UploadIcon, CheckCircleIcon, XIcon, Trash2Icon, DownloadIcon, HistoryIcon, CodeIcon } from './icons';
import { AgentTool } from '../types';

type ImportStatus = 'idle' | 'parsing' | 'saving' | 'success' | 'error';
type ImportType = 'call_logs' | 'tools';

const DataImportView: React.FC = () => {
    const [status, setStatus] = useState<ImportStatus>('idle');
    const [error, setError] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<string>('');
    const [importType, setImportType] = useState<ImportType>('call_logs');

    // Helper for CSV parsing
    const parseCSV = (csvText: string) => {
        const allLines = csvText.trim().replace(/\r\n/g, '\n').split('\n');
        if (allLines.length < 1) return { headers: [], rows: [] };
        
        // Handle potential empty lines at the end
        const lines = allLines.filter(line => line.trim().length > 0);
        if (lines.length < 1) return { headers: [], rows: [] };

        const headers = lines.shift()!.split(',').map(h => h.trim().replace(/^"|"$/g, ''));
        
        // Regex to handle quoted fields with commas
        const rows = lines.map(line => {
            const regex = /(".*?"|[^",\s]+)(?=\s*,|\s*$)/g;
            const matches = line.match(regex) || [];
            return matches.map(m => m.replace(/^"|"$/g, '').replace(/""/g, '"').trim());
        });
        return { headers, rows };
    };

    const onDrop = useCallback(async (acceptedFiles: File[]) => {
        const file = acceptedFiles[0];
        if (!file) return;

        setStatus('parsing');
        setError(null);
        setSuccessMessage('');

        try {
            const text = await file.text();
            const { headers, rows } = parseCSV(text);

            if (importType === 'call_logs') {
                // Basic validation for Call Logs
                if (!headers.includes('c_id') && !headers.includes('call_id')) {
                     throw new Error("Invalid CSV format for Call Logs. Required headers: call_id (or c_id), from, to");
                }
                
                const logs = rows.map(row => {
                    const rowData: { [key: string]: string } = {};
                    headers.forEach((header, i) => { rowData[header] = row[i] || ''; });
                    
                    return {
                        call_id: rowData.c_id || rowData.call_id,
                        created_at: rowData.created_at || new Date().toISOString(),
                        duration: Math.round(parseFloat(rowData.call_length || rowData.duration || '0') * 60) || 0,
                        from: rowData.from,
                        to: rowData.to,
                        recording_url: rowData.recording_url || '',
                        summary: rowData.summary || '',
                        concatenated_transcript: rowData.transcripts || rowData.concatenated_transcript || '',
                        transcript: [] 
                    };
                }).filter(l => l.call_id);

                setStatus('saving');
                await dataService.upsertCallLogs(logs);
                setSuccessMessage(`Successfully imported ${logs.length} call logs.`);

            } else if (importType === 'tools') {
                // Basic validation for Tools
                if (!headers.includes('name') || !headers.includes('url')) {
                    throw new Error("Invalid CSV format for Tools. Required headers: name, url, method");
                }

                const tools: AgentTool[] = rows.map(row => {
                    const rowData: { [key: string]: string } = {};
                    headers.forEach((header, i) => { rowData[header] = row[i] || ''; });

                    return {
                        id: rowData.id || `tool-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                        name: rowData.name,
                        description: rowData.description || '',
                        method: (rowData.method as 'GET' | 'POST') || 'POST',
                        url: rowData.url,
                        headers: rowData.headers || '{}',
                        body: rowData.body || '{}',
                        timeout: rowData.timeout ? parseInt(rowData.timeout) : undefined
                    };
                }).filter(t => t.name && t.url);

                setStatus('saving');
                await dataService.upsertTools(tools);
                setSuccessMessage(`Successfully imported ${tools.length} tools.`);
            }
            
            setStatus('success');

        } catch (err: any) {
            console.error("Import error:", err);
            setError(err.message);
            setStatus('error');
        }
    }, [importType]);

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop,
        accept: { 'text/csv': ['.csv'] },
        multiple: false,
    });

    const handleExport = async () => {
        setStatus('parsing'); // reusing status for loading visual
        setError(null);
        try {
            let data: any[] = [];
            let filename = '';
            
            if (importType === 'call_logs') {
                data = await dataService.getCallLogs();
                filename = `eburon_call_logs_${new Date().toISOString().slice(0,10)}.csv`;
            } else {
                data = await dataService.getTools();
                filename = `eburon_tools_${new Date().toISOString().slice(0,10)}.csv`;
            }
            
            if (data.length === 0) {
                throw new Error(`No ${importType.replace('_', ' ')} found to export.`);
            }

            // Generate CSV
            const headers = Object.keys(data[0]);
            const csvContent = [
                headers.join(','),
                ...data.map(row => headers.map(header => {
                    let val = row[header];
                    // Handle objects/arrays by stringifying
                    if (typeof val === 'object' && val !== null) val = JSON.stringify(val);
                    // Escape double quotes
                    val = String(val ?? '').replace(/"/g, '""');
                    return `"${val}"`;
                }).join(','))
            ].join('\n');

            const blob = new Blob([csvContent], { type: 'text/csv' });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
            
            setStatus('success');
            setSuccessMessage(`Successfully exported ${data.length} records.`);
            setTimeout(() => setStatus('idle'), 2000);

        } catch (e: any) {
            setError(e.message);
            setStatus('error');
        }
    };

    const handleClearData = async () => {
        const typeLabel = importType === 'call_logs' ? "Call Logs" : "Tools";
        if (window.confirm(`Are you sure you want to delete ALL ${typeLabel} from the local cache? This cannot be undone.`)) {
            setStatus('saving');
            setError(null);
            try {
                if (importType === 'call_logs') {
                    await dataService.clearCallLogs();
                } else {
                    // Note: dataService might need a clearTools function, but for now we can't easily clear tools in bulk via service without ID. 
                    // Assuming for this demo we mostly care about clearing logs.
                    // If needed we could add clearTools to dataService.
                    // For safety, let's restrict this button to Call Logs for now or implement proper clear logic.
                    // Actually, let's implement a basic clear loop for tools if selected.
                    const tools = await dataService.getTools();
                    for (const t of tools) {
                        await dataService.deleteTool(t.id);
                    }
                }
                setSuccessMessage(`All ${typeLabel} have been deleted.`);
                setStatus('success');
            } catch (err: any) {
                setError(err.message);
                setStatus('error');
            }
        }
    }

    const handleDownloadTemplate = () => {
        let headers: string[] = [];
        let dummyData: string[] = [];
        let filename = '';

        if (importType === 'call_logs') {
            headers = ['c_id', 'created_at', 'call_length', 'from', 'to', 'recording_url', 'summary', 'transcripts'];
            dummyData = ['demo-id-123', new Date().toISOString(), '5.5', '+1555000000', '+1555111111', 'https://example.com/rec.wav', 'Sample call summary', 'user: Hello | assistant: Hi'];
            filename = 'eburon_call_logs_template.csv';
        } else {
            headers = ['id', 'name', 'description', 'method', 'url', 'headers', 'body'];
            dummyData = ['tool-1', 'Check Weather', 'Gets current weather', 'GET', 'https://api.weather.com/v1/current', '{}', '{"type":"object","properties":{"lat":{"type":"number"}}}'];
            filename = 'eburon_tools_template.csv';
        }

        const csvContent = [headers.join(','), dummyData.map(d => `"${d.replace(/"/g, '""')}"`).join(',')].join('\n');
        
        const blob = new Blob([csvContent], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
    };

    const renderStatus = () => {
        switch(status) {
            case 'parsing':
                return <LoadingIndicator text="Processing CSV..." size="small" />;
            case 'saving':
                return <LoadingIndicator text="Saving data..." size="small" />;
            case 'success':
                return (
                    <div className="text-center text-eburon-ok">
                        <CheckCircleIcon className="w-12 h-12 mx-auto mb-2" />
                        <p className="font-semibold">{successMessage}</p>
                    </div>
                );
            case 'error':
                return (
                    <div className="text-center text-red-400">
                        <XIcon className="w-12 h-12 mx-auto mb-2" />
                        <p className="font-semibold">Operation Failed</p>
                        <p className="text-sm">{error}</p>
                    </div>
                );
            case 'idle':
            default:
                return (
                    <div className="text-center text-eburon-fg/70">
                        <UploadIcon className="w-12 h-12 mx-auto mb-4" />
                        <p className="font-semibold text-lg">{isDragActive ? "Drop the file here..." : "Drag & drop a CSV file here"}</p>
                        <p className="text-sm">or click to select file</p>
                    </div>
                );
        }
    }

    return (
        <div className="p-8 h-full flex flex-col items-center">
            <div className="w-full max-w-3xl">
                <div className="flex justify-between items-end mb-6">
                    <div>
                        <h1 className="text-3xl font-bold text-eburon-fg mb-2">Data Management</h1>
                        <p className="text-eburon-fg/70">
                            Import or export data to manage your system.
                        </p>
                    </div>
                    
                    {/* Type Selection */}
                    <div className="flex bg-eburon-panel border border-eburon-border p-1 rounded-lg">
                        <button
                            onClick={() => { setImportType('call_logs'); setStatus('idle'); }}
                            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${importType === 'call_logs' ? 'bg-eburon-accent text-white shadow-sm' : 'text-eburon-fg/60 hover:text-white'}`}
                        >
                            <HistoryIcon className="w-4 h-4" />
                            Call Logs
                        </button>
                        <button
                            onClick={() => { setImportType('tools'); setStatus('idle'); }}
                            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${importType === 'tools' ? 'bg-eburon-accent text-white shadow-sm' : 'text-eburon-fg/60 hover:text-white'}`}
                        >
                            <CodeIcon className="w-4 h-4" />
                            Agent Tools
                        </button>
                    </div>
                </div>

                {/* Import Area */}
                <div
                    {...getRootProps()}
                    className={`border-2 border-dashed rounded-xl p-12 transition-colors duration-300 cursor-pointer flex items-center justify-center h-64 mb-6
                        ${isDragActive ? 'border-eburon-accent bg-eburon-accent/10' : 'border-eburon-border hover:border-eburon-accent bg-eburon-panel'}`
                    }
                >
                    <input {...getInputProps()} />
                    {renderStatus()}
                </div>

                {/* Actions */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="flex gap-3">
                        <button 
                            onClick={handleDownloadTemplate}
                            className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-eburon-panel border border-eburon-border rounded-xl hover:bg-eburon-accent/10 hover:text-eburon-accent transition-colors text-sm font-medium"
                        >
                            <DownloadIcon className="w-4 h-4" />
                            CSV Template
                        </button>
                        <button 
                            onClick={handleExport}
                            className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-eburon-panel border border-eburon-border rounded-xl hover:bg-eburon-accent/10 hover:text-eburon-accent transition-colors text-sm font-medium"
                        >
                            <UploadIcon className="w-4 h-4 rotate-180" />
                            Export Data
                        </button>
                    </div>
                    
                    <div className="flex justify-end">
                         <button
                            onClick={handleClearData}
                            className="w-full md:w-auto flex items-center justify-center gap-2 bg-red-500/10 border border-red-500/20 hover:bg-red-500/20 text-red-400 font-bold py-3 px-6 rounded-xl transition-colors"
                        >
                            <Trash2Icon className="w-5 h-5" />
                            <span>Clear {importType === 'call_logs' ? 'Logs' : 'Tools'}</span>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default DataImportView;
