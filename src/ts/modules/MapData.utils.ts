export const tsvJSON = (tsv: string) => {
    const lines = tsv.split("\n");
    const result = [];
    const headers = ['name', 'description', 'url', 'category', 'lat', 'lon', 'loc'];

    for (let i = 1; i < lines.length; i++) {
        const obj = {};
        const currentline = lines[i].replace(/\r/, '').split("\t");
        
        for (let j = 0; j < headers.length; j++) {
        obj[headers[j]] = currentline[j] || null;
        }

        result.push(obj);
    }

    return result;
}