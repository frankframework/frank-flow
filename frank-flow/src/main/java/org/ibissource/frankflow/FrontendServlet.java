/*
   Copyright 2022-2024 WeAreFrank!

   Licensed under the Apache License, Version 2.0 (the "License");
   you may not use this file except in compliance with the License.
   You may obtain a copy of the License at

       http://www.apache.org/licenses/LICENSE-2.0

   Unless required by applicable law or agreed to in writing, software
   distributed under the License is distributed on an "AS IS" BASIS,
   WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   See the License for the specific language governing permissions and
   limitations under the License.
*/
package org.ibissource.frankflow;

import java.io.File;
import java.io.IOException;
import java.io.InputStream;
import java.net.MalformedURLException;
import java.net.URL;

import javax.servlet.ServletContext;
import javax.servlet.ServletException;
import javax.servlet.http.HttpServlet;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import javax.ws.rs.core.MediaType;

import org.apache.commons.io.FilenameUtils;
import org.apache.commons.io.IOUtils;
import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.Logger;
import org.ibissource.frankflow.util.MimeTypeUtil;
import org.springframework.util.StringUtils;

/**
 * 
 * @author Niels Meijer
 */
public class FrontendServlet extends HttpServlet {

	private static final long serialVersionUID = 123L;

	private String frontendPath = null;
	private final Logger log = LogManager.getLogger(this);

	private String basePath;

	@Override
	public void init() throws ServletException {
		super.init();
		ServletContext context = getServletConfig().getServletContext();

		frontendPath = (String) context.getAttribute("frontend-location");
		basePath = (String) context.getAttribute("basepath");
	}

	@Override
	protected void doGet(HttpServletRequest req, HttpServletResponse resp) throws ServletException, IOException {
		String path = req.getPathInfo();
		if(path == null) {
			log.warn("no path found, redirecting to ["+basePath+"]");

			resp.sendRedirect(req.getContextPath() + basePath);
			return;
		}
		if(path.equals("/")) {
			path += "index.html";
		}

		URL resource = findResource(path);
		if(resource == null) {
			resp.sendError(404, "file not found");
			return;
		}

		MediaType mimeType = MimeTypeUtil.determineFromPathMimeType(path);
		if(mimeType != null) {
			resp.setContentType(mimeType.toString());
		}

		try(InputStream in = resource.openStream()) {
			IOUtils.copy(in, resp.getOutputStream());
		} catch (IOException e) {
			log.warn("error reading or writing resource to servlet", e);
			resp.sendError(500, e.getMessage());
			return;
		}

		resp.flushBuffer();
	}

	private URL findResource(String path) {
		String normalizedPath = FilenameUtils.normalize(path, true);
		if(normalizedPath.startsWith("/")) {
			normalizedPath = normalizedPath.substring(1);
		}

		URL url = null;
		try {
			if(!StringUtils.hasLength(frontendPath)) {
				url = new File("/frontend/"+normalizedPath).toURI().toURL();
				log.debug("looking up resource from path [/frontend/{}] to url [{}]", normalizedPath, url);
			} else {
				url = new File(frontendPath+"/"+normalizedPath).toURI().toURL();
				log.debug("looking up resource from frontendPath [{}/{}] to url [{}]", frontendPath, normalizedPath, url);
			}
		} catch (MalformedURLException e) {
			log.error(e);
		}
		log.debug("{} resource from path [{}]", url==null?"did not find": "found", normalizedPath);
        return url;
    }
}
