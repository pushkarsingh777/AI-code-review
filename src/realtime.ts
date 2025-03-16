import * as vscode from 'vscode';
import { GoogleGenerativeAI } from '@google/generative-ai';

// Global toggle for auto suggestions
let autoSuggestionsEnabled = false;
let customPrompt = `
Act like Copilot in VS CODE. What it does is that it completes the code that it sees.
All you need to do is write the code that should come after the code that you given.
You are obviously really good at code completion at realtime, so you should be able to understand what code should come next.
Here are some examples that can help you along:

PROMPT : print("hell

OUTPUT : o world")

PROMPT: def odd_even2(list):
    for num in list:
        if num % 2 == 0:
            even = num
    
    for num in list:
        if num % 2 != 0:
            odd = num

OUTPUT : 
# adding an empty line because it should 
break
        
    return even, odd

PROMPT : 
        def biggest_odd(list):
            new_list = [letter for letter in list if int(letter) % 2 != 0]


OUTPUT : 
            
        return max(new_list)
# add spaces before adding test case like this one
        list = "23569"
        print(biggest_odd(list))

Just like the example, you should only write what the next should be. You should not return anything harmful or something
that does not make sense. Give back what should be the code AFTERWARDS and do not return anything else except the code.
`;

// Toggle command to enable/disable suggestions
export function toggleAutoSuggestions() {
    autoSuggestionsEnabled = !autoSuggestionsEnabled;
    vscode.window.showInformationMessage(`Auto Suggestions ${autoSuggestionsEnabled ? 'Enabled' : 'Disabled'}`);
}

// Command to set custom prompt
export function setCustomPrompt() {
    vscode.window.showInputBox({
        prompt: "Enter your custom prompt for Gemini",
        placeHolder: "Continue the code based on the context:",
        value: customPrompt
    }).then(input => {
        if (input !== undefined) {
            customPrompt = input;
            vscode.window.showInformationMessage(`Custom prompt updated`);
        }
    });
}

// Register the inline completion provider
export function registerInlineCompletionProvider(context: vscode.ExtensionContext) {
    context.subscriptions.push(vscode.languages.registerInlineCompletionItemProvider({ pattern: '**/*' }, {
        async provideInlineCompletionItems(
            document: vscode.TextDocument,
            position: vscode.Position,
            contextInline: vscode.InlineCompletionContext,
            token: vscode.CancellationToken
        ): Promise<vscode.InlineCompletionList | undefined> {
            if (!autoSuggestionsEnabled) {
                return;
            }

            // Select context: 2 lines before and after current line
            const startLine = Math.max(0, position.line - 2);
            const endLine = Math.min(document.lineCount - 1, position.line + 2);
            let snippet = '';
            for (let i = startLine; i <= endLine; i++) {
                snippet += document.lineAt(i).text + '\n';
            }

            const fullPrompt = `${customPrompt}\n\n${snippet}`;
            const suggestion = await queryGemini(fullPrompt);
            if (!suggestion) {
                return;
            }
            
            const range = new vscode.Range(position, position);
            return new vscode.InlineCompletionList([new vscode.InlineCompletionItem(suggestion, range)]);
        }
    }));
}

// Query the Gemini API with the code context
async function queryGemini(prompt: string): Promise<string> {
    const modelName = vscode.workspace.getConfiguration().get<string>('google.gemini.textModel', 'models/gemini-2.0-flash-lite');
    const apiKey = vscode.workspace.getConfiguration().get<string>('google.gemini.apiKey');
    if (!apiKey) {
        vscode.window.showErrorMessage('API key not configured. Check your settings.');
        return '';
    }

    const genai = new GoogleGenerativeAI(apiKey);
    const model = genai.getGenerativeModel({ model: modelName });
    const result = await model.generateContent(prompt);
    const response = await result.response;
    return response.text() || '';
}