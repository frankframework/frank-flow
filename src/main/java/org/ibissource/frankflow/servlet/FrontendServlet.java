package org.ibissource.frankflow.servlet;

import java.io.IOException;
import java.io.InputStream;
import java.net.URL;

import javax.servlet.ServletException;
import javax.servlet.http.HttpServlet;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import javax.ws.rs.core.MediaType;

import org.apache.commons.io.IOUtils;
import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.Logger;
import org.ibissource.frankflow.lifecycle.Configuration;
import org.ibissource.frankflow.util.FileUtils;
import org.ibissource.frankflow.util.MimeTypeUtil;
import org.springframework.util.StringUtils;

public class FrontendServlet extends HttpServlet {

    private static final long serialVersionUID = 123L;

    private String frontendPath = null;
    private final Logger log = LogManager.getLogger(this);

    @Override
    public void init() throws ServletException {
        super.init();

        frontendPath = FileUtils.getFrontendPath();
    }

    @Override
    protected void doGet(HttpServletRequest req, HttpServletResponse resp) throws ServletException, IOException {
        String path = req.getPathInfo();
        if (path == null) {
            log.warn("no path found, redirecting to [" + Configuration.BASEPATH + "]");

            resp.sendRedirect(req.getContextPath() + Configuration.BASEPATH);
            return;
        }
        if (path.equals("/")) {
            path += "index.html";
        }

        URL resource = null;
        if (StringUtils.isEmpty(frontendPath)) {
            resource = this.getClass().getResource("/frontend" + path);
        } else {
            resource = new URL(frontendPath + path);
        }

        if (resource == null) {
            resp.sendError(404, "file not found");
            return;
        }

        MediaType mimeType = MimeTypeUtil.determineFromPathMimeType(path);
        if (mimeType != null) {
            resp.setContentType(mimeType.toString());
        }

        try (InputStream in = resource.openStream()) {
            IOUtils.copy(in, resp.getOutputStream());
        } catch (IOException e) {
            resp.sendError(500, e.getMessage());
            return;
        }

        resp.flushBuffer();
    }
}
