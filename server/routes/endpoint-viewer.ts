import express from 'express';
import { Express, Application, Request, Response } from 'express';

const router = express.Router();

// Function to extract routes from Express app
function extractRoutes(app: Application): any[] {
  const routes: any[] = [];
  
  // Get registered routes
  const stack = (app as any)._router.stack;
  
  stack.forEach((layer: any) => {
    if (layer.route) {
      // Routes directly on the app
      const path = layer.route.path;
      const methods = Object.keys(layer.route.methods)
        .filter(method => layer.route.methods[method])
        .map(method => method.toUpperCase());
      
      routes.push({
        path,
        methods,
        type: 'route'
      });
    } else if (layer.name === 'router' && layer.handle.stack) {
      // Router middleware
      // Extract router path from regexp
      let routerPath = '/';
      if (layer.regexp) {
        const regexpStr = layer.regexp.toString();
        const match = regexpStr.match(/^\/?\^(\\\/[^\?]+)\?/i);
        if (match) {
          routerPath = match[1].replace(/\\\//g, '/');
        }
      }
      
      layer.handle.stack.forEach((routerLayer: any) => {
        if (routerLayer.route) {
          const subPath = routerLayer.route.path;
          const fullPath = routerPath + (subPath === '/' ? '' : subPath);
          
          const methods = Object.keys(routerLayer.route.methods)
            .filter(method => routerLayer.route.methods[method])
            .map(method => method.toUpperCase());
          
          routes.push({
            path: fullPath,
            methods,
            type: 'router'
          });
        }
      });
    }
  });
  
  return routes;
}

// Endpoint to get all API routes
router.get('/', (req: Request, res: Response) => {
  const app = req.app as Application;
  const routes = extractRoutes(app);
  
  // Group routes by their base path
  const groupedRoutes: Record<string, any[]> = {};
  
  routes.forEach(route => {
    const basePath = route.path.split('/')[1] || 'root';
    if (!groupedRoutes[basePath]) {
      groupedRoutes[basePath] = [];
    }
    groupedRoutes[basePath].push(route);
  });
  
  res.json({
    totalEndpoints: routes.length,
    groups: groupedRoutes,
    routes: routes.sort((a, b) => a.path.localeCompare(b.path))
  });
});

// HTML view for the endpoint viewer
router.get('/view', (req: Request, res: Response) => {
  const app = req.app as Application;
  const routes = extractRoutes(app);
  
  // Group routes by their base path
  const groupedRoutes: Record<string, any[]> = {};
  
  routes.forEach(route => {
    const basePath = route.path.split('/')[1] || 'root';
    if (!groupedRoutes[basePath]) {
      groupedRoutes[basePath] = [];
    }
    groupedRoutes[basePath].push(route);
  });
  
  // Generate HTML
  let html = `
  <!DOCTYPE html>
  <html lang="en">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Guardian MVP API Endpoints</title>
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0-alpha1/dist/css/bootstrap.min.css" rel="stylesheet">
    <style>
      body {
        padding: 20px;
        font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      }
      .method {
        display: inline-block;
        padding: 2px 6px;
        border-radius: 4px;
        font-size: 12px;
        font-weight: bold;
        margin-right: 5px;
      }
      .get { background-color: #61affe; color: white; }
      .post { background-color: #49cc90; color: white; }
      .put { background-color: #fca130; color: white; }
      .delete { background-color: #f93e3e; color: white; }
      .patch { background-color: #50e3c2; color: white; }
      .head { background-color: #9012fe; color: white; }
      .options { background-color: #0d5aa7; color: white; }
      .card {
        margin-bottom: 20px;
        box-shadow: 0 4px 6px rgba(0,0,0,0.1);
      }
      .card-header {
        font-weight: bold;
        background-color: #f8f9fa;
      }
      .endpoint-row {
        border-bottom: 1px solid #eee;
        padding: 10px 0;
      }
      .endpoint-row:last-child {
        border-bottom: none;
      }
      .path {
        font-family: monospace;
        font-size: 14px;
        word-break: break-all;
      }
      .badge-count {
        font-size: 12px;
        background-color: #6c757d;
        color: white;
        padding: 2px 6px;
        border-radius: 10px;
        margin-left: 5px;
      }
      .navbar {
        margin-bottom: 20px;
      }
    </style>
  </head>
  <body>
    <nav class="navbar navbar-expand-lg navbar-dark bg-dark">
      <div class="container-fluid">
        <a class="navbar-brand" href="#">Guardian MVP API</a>
        <div class="d-flex">
          <a href="/api/endpoint-viewer" class="btn btn-sm btn-outline-light me-2">JSON View</a>
          <a href="/health" class="btn btn-sm btn-outline-light" target="_blank">Health Check</a>
        </div>
      </div>
    </nav>
    
    <div class="container">
      <div class="row">
        <div class="col-12">
          <div class="alert alert-info">
            <h4>API Endpoints Overview</h4>
            <p>Total endpoints: ${routes.length}</p>
            <p>Server time: ${new Date().toLocaleString()}</p>
          </div>
        </div>
      </div>
      
      <div class="row">
        <div class="col-12">
          <div class="accordion" id="endpointAccordion">
  `;
  
  // Generate accordion items for each group
  Object.keys(groupedRoutes).sort().forEach((group, index) => {
    const endpoints = groupedRoutes[group];
    html += `
            <div class="accordion-item">
              <h2 class="accordion-header" id="heading${index}">
                <button class="accordion-button ${index !== 0 ? 'collapsed' : ''}" type="button" data-bs-toggle="collapse" data-bs-target="#collapse${index}" aria-expanded="${index === 0 ? 'true' : 'false'}" aria-controls="collapse${index}">
                  ${group} <span class="badge-count">${endpoints.length}</span>
                </button>
              </h2>
              <div id="collapse${index}" class="accordion-collapse collapse ${index === 0 ? 'show' : ''}" aria-labelledby="heading${index}" data-bs-parent="#endpointAccordion">
                <div class="accordion-body p-0">
                  <div class="list-group list-group-flush">
    `;
    
    // Sort endpoints by path
    endpoints.sort((a, b) => a.path.localeCompare(b.path));
    
    // Add each endpoint
    endpoints.forEach(endpoint => {
      html += `
                    <div class="list-group-item">
                      <div class="d-flex justify-content-between align-items-center">
                        <div>
                          ${endpoint.methods.map((method: string) => 
                            `<span class="method ${method.toLowerCase()}">${method}</span>`
                          ).join('')}
                          <span class="path">${endpoint.path}</span>
                        </div>
                        <div>
                          <button class="btn btn-sm btn-outline-primary test-btn" 
                                  data-path="${endpoint.path}" 
                                  data-methods="${endpoint.methods.join(',')}"
                                  onclick="showTestModal('${endpoint.path}', '${endpoint.methods.join(',')}')">
                            Test
                          </button>
                        </div>
                      </div>
                    </div>
      `;
    });
    
    html += `
                  </div>
                </div>
              </div>
            </div>
    `;
  });
  
  html += `
          </div>
        </div>
      </div>
    </div>
    
    <!-- Test Modal -->
    <div class="modal fade" id="testModal" tabindex="-1" aria-labelledby="testModalLabel" aria-hidden="true">
      <div class="modal-dialog modal-lg">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title" id="testModalLabel">Test Endpoint</h5>
            <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
          </div>
          <div class="modal-body">
            <form id="testForm">
              <div class="mb-3">
                <label for="endpointUrl" class="form-label">URL</label>
                <input type="text" class="form-control" id="endpointUrl" readonly>
              </div>
              <div class="mb-3">
                <label for="methodSelect" class="form-label">Method</label>
                <select class="form-select" id="methodSelect"></select>
              </div>
              <div class="mb-3">
                <label for="requestBody" class="form-label">Request Body (JSON)</label>
                <textarea class="form-control" id="requestBody" rows="5"></textarea>
              </div>
              <div class="mb-3">
                <label for="authToken" class="form-label">Authorization Token (JWT)</label>
                <input type="text" class="form-control" id="authToken" placeholder="Bearer ...">
              </div>
            </form>
            <div class="mb-3">
              <label class="form-label">Response</label>
              <div class="card">
                <div class="card-header d-flex justify-content-between align-items-center">
                  <span>Response</span>
                  <span id="responseStatus"></span>
                </div>
                <div class="card-body">
                  <pre id="responseBody" style="max-height: 300px; overflow-y: auto;"></pre>
                </div>
              </div>
            </div>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
            <button type="button" class="btn btn-primary" id="sendRequestBtn">Send Request</button>
          </div>
        </div>
      </div>
    </div>
    
    <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0-alpha1/dist/js/bootstrap.bundle.min.js"></script>
    <script>
      // Function to show the test modal
      function showTestModal(path, methods) {
        const modal = new bootstrap.Modal(document.getElementById('testModal'));
        const methodsArray = methods.split(',');
        
        // Set the endpoint URL
        document.getElementById('endpointUrl').value = path;
        
        // Populate method select
        const methodSelect = document.getElementById('methodSelect');
        methodSelect.innerHTML = '';
        methodsArray.forEach(method => {
          const option = document.createElement('option');
          option.value = method;
          option.textContent = method;
          methodSelect.appendChild(option);
        });
        
        // Clear previous response
        document.getElementById('responseBody').textContent = '';
        document.getElementById('responseStatus').textContent = '';
        
        // Try to get token from localStorage
        const token = localStorage.getItem('token');
        if (token) {
          document.getElementById('authToken').value = \`Bearer \${token}\`;
        }
        
        modal.show();
      }
      
      // Handle send request button
      document.getElementById('sendRequestBtn').addEventListener('click', async () => {
        const url = document.getElementById('endpointUrl').value;
        const method = document.getElementById('methodSelect').value;
        const body = document.getElementById('requestBody').value;
        const authToken = document.getElementById('authToken').value;
        
        const responseBody = document.getElementById('responseBody');
        const responseStatus = document.getElementById('responseStatus');
        
        try {
          // Prepare request options
          const options = {
            method,
            headers: {
              'Content-Type': 'application/json'
            }
          };
          
          // Add authorization header if provided
          if (authToken) {
            options.headers.Authorization = authToken;
          }
          
          // Add body for non-GET requests
          if (method !== 'GET' && body.trim()) {
            options.body = body;
          }
          
          // Send the request
          responseBody.textContent = 'Loading...';
          responseStatus.textContent = '';
          
          const response = await fetch(url, options);
          const isJson = response.headers.get('content-type')?.includes('application/json');
          
          let data;
          if (isJson) {
            data = await response.json();
            responseBody.textContent = JSON.stringify(data, null, 2);
          } else {
            data = await response.text();
            responseBody.textContent = data;
          }
          
          // Set response status
          responseStatus.textContent = \`\${response.status} \${response.statusText}\`;
          responseStatus.className = response.ok ? 'text-success' : 'text-danger';
          
        } catch (error) {
          responseBody.textContent = \`Error: \${error.message}\`;
          responseStatus.textContent = 'Request Failed';
          responseStatus.className = 'text-danger';
        }
      });
    </script>
  </body>
  </html>
  `;
  
  res.send(html);
});

export default router;
