const fs = require('fs');
const content = fs.readFileSync('dist/main.js', 'utf8');
const index = content.indexOf('lucide-react');
if (index !== -1) {
    console.log('Found "lucide-react" at index', index);
    const start = Math.max(0, index - 50);
    const end = Math.min(content.length, index + 50);
    console.log('Context:');
    console.log(content.substring(start, end));

    // Find next occurrence
    let nextIndex = content.indexOf('lucide-react', index + 1);
    while (nextIndex !== -1) {
        console.log('Found "lucide-react" at index', nextIndex);
        const s = Math.max(0, nextIndex - 50);
        const e = Math.min(content.length, nextIndex + 50);
        console.log('Context:');
        console.log(content.substring(s, e));
        nextIndex = content.indexOf('lucide-react', nextIndex + 1);
    }
} else {
    console.log('Not found');
}
