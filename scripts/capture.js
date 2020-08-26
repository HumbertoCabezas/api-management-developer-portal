const fs = require("fs");
const path = require("path");
const https = require("https");
const { downloadBlobs, getStorageSasTokenOrThrow } = require("./utils");
const managementApiEndpoint = process.argv[2];
const managementApiAccessToken = process.argv[3];
const destinationFolder = process.argv[4];
const localMediaFolder = `./${destinationFolder}/content`;

process.env["NODE_TLS_REJECT_UNAUTHORIZED"] = 0;

var options = {
    port: 443,
    method: "GET",
    headers: {
        "Authorization": managementApiAccessToken
    }
};

async function request(url) {
    return new Promise((resolve, reject) => {
        const req = https.request(url, options, (resp) => {
            let data = "";

            resp.on("data", (chunk) => {
                data += chunk;
            });

            resp.on("end", () => {
                try {
                    resolve(JSON.parse(data));
                }
                catch (e) {
                    reject(e);
                    console.log(url);
                }
            });
        });

        req.on("error", (e) => {
            reject(e);
        });

        req.end();
    });
}

async function getContentTypes() {
    const data = await request(`https://${managementApiEndpoint}/contentTypes?api-version=2018-06-01-preview`);
    const contentTypes = data.value.map(x => x.id.replace("\/contentTypes\/", ""));

    return contentTypes;
}

async function getContentItems(contentType) {
    const data = await request(`https://${managementApiEndpoint}/contentTypes/${contentType}/contentItems?api-version=2018-06-01-preview`);
    const contentItems = data.value;

    return contentItems;
}

async function captureJson() {
    const result = {};
    const contentTypes = await getContentTypes();

    for (const contentType of contentTypes) {
        const contentItems = await getContentItems(contentType);

        contentItems.forEach(contentItem => {
            result[contentItem.id] = contentItem;

            delete contentItem.id;
        });
    }

    await fs.promises.mkdir(path.resolve(destinationFolder), { recursive: true });

    fs.writeFileSync(`${destinationFolder}/data.json`, JSON.stringify(result));
}

async function capture() {
    const blobStorageUrl = await getStorageSasTokenOrThrow(managementApiEndpoint, managementApiAccessToken);

    await captureJson();
    await downloadBlobs(blobStorageUrl, localMediaFolder);
}

capture()
    .then(() => {
        console.log("DONE");
    })
    .catch(error => {
        console.log(error);
    })