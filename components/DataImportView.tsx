import React, { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import * as dataService from '../services/dataService';
import { LoadingIndicator } from './LoadingIndicator';
import { UploadIcon, CheckCircleIcon, XIcon, Trash2Icon } from './icons';

type ImportStatus = 'idle' | 'parsing' | 'saving' | 'success' | 'error';

const DataImportView: React.FC = () => {
    const [status, setStatus] = useState<ImportStatus>('idle');
    const [error, setError] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<string>('');

    const onDrop = useCallback(async (acceptedFiles: File[]) => {
        const file = acceptedFiles[0];
        if (!file) return;

        setStatus('parsing');
        setError(null);
        setSuccessMessage('');

        try {
            const callLogs = await dataService.loadCallLogsFromCSV();
            setStatus('saving');
            await dataService.upsertCallLogs(callLogs);
            
            setStatus('success');
            setSuccessMessage(`Successfully imported ${callLogs.length} call logs. View them in the 'History' tab.`);

        } catch (err) {
            console.error("Import error:", err);
            setError((err as Error).message);
            setStatus('error');
        }
    }, []);

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop,
        accept: { 'text/csv': ['.csv'] },
        multiple: false,
    });

    const handleClearLogs = async () => {
        if (window.confirm("Are you sure you want to delete ALL call logs from the local cache? This action cannot be undone, but data will be re-imported from `data.csv` on the next visit to the History tab.")) {
            setStatus('saving');
            setError(null);
            try {
                await dataService.clearCallLogs();
                setSuccessMessage("All cached call logs have been deleted.");
                setStatus('success');
            } catch (err) {
                setError((err as Error).message);
                setStatus('error');
            }
        }
    }


    const renderStatus = () => {
        switch(status) {
            case 'parsing':
                return <LoadingIndicator text="Parsing CSV..." size="small" />;
            case 'saving':
                return <LoadingIndicator text="Saving logs to database..." size="small" />;
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
                        <p className="font-semibold">Import Failed</p>
                        <p className="text-sm">{error}</p>
                    </div>
                );
            case 'idle':
            default:
                return (
                    <div className="text-center text-eburon-fg/70">
                        <UploadIcon className="w-12 h-12 mx-auto mb-4" />
                        <p className="font-semibold text-lg">{isDragActive ? "Drop the file here..." : "Drag & drop a new data.csv here"}</p>
                        <p className="text-sm">or click to select file to override existing data</p>
                    </div>
                );
        }
    }


    return (
        <div className="p-8 h-full flex flex-col items-center">
            <div className="w-full max-w-3xl">
                <h1 className="text-3xl font-bold text-eburon-fg mb-2">Import Data</h1>
                <p className="text-eburon-fg/70 mb-8">
                    The application automatically loads `data.csv` on startup. You can use this page to upload a different CSV file or clear the existing call log cache.
                </p>

                <div
                    {...getRootProps()}
                    className={`border-2 border-dashed rounded-xl p-12 transition-colors duration-300 cursor-pointer flex items-center justify-center h-64
                        ${isDragActive ? 'border-eburon-accent bg-eburon-accent/10' : 'border-eburon-border hover:border-eburon-accent'}`
                    }
                >
                    <input {...getInputProps()} />
                    {renderStatus()}
                </div>

                <div className="mt-8 flex justify-center">
                     <button
                        onClick={handleClearLogs}
                        className="flex items-center gap-2 bg-red-800/50 hover:bg-red-800/80 text-red-200 font-bold py-2 px-4 rounded-lg transition-colors"
                    >
                        <Trash2Icon className="w-5 h-5" />
                        <span>Clear All Call Logs</span>
                    </button>
                </div>
            </div>
        </div>
    );
};

export default DataImportView;
