package org.ibissource.frankflow.servlet;

import org.apache.cxf.Bus;
import org.apache.cxf.transport.servlet.CXFServlet;
import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.Logger;
import org.springframework.context.event.ContextRefreshedEvent;

public class BackendServlet extends CXFServlet {
    private final Logger log = LogManager.getLogger(this);

    private static final long serialVersionUID = 123L;

    @Override
    public void setBus(Bus bus) {
        if (bus != null) {
            log.debug("Successfully created Frank!Flow-API with SpringBus [" + bus.getId() + "]");
            getServletContext().log("Successfully created Frank!Flow-API with SpringBus [" + bus.getId() + "]");
        }

        super.setBus(bus);
    }

    @Override
    public void onApplicationEvent(ContextRefreshedEvent event) {
        // This event listens to all Spring refresh events.
        // When adding new Spring contexts (with this as a parent) refresh events originating from other contexts will also trigger this method.
        // Since we never want to reinitialize this servlet, we can ignore the 'refresh' event completely!
    }
}
