/*
Copyright 2020 WeAreFrank!

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
package org.ibissource.frankflow.lifecycle;

import java.util.HashMap;
import java.util.Map;

import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.Logger;
import org.ibissource.frankflow.servlet.BackendServlet;
import org.ibissource.frankflow.servlet.FrontendServlet;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Scope;

@org.springframework.context.annotation.Configuration
public class Configuration {
    private final Logger log = LogManager.getLogger(this);
    public static final String BASEPATH = System.getProperty("frank-flow.basepath", "/frank-flow/");

    @Bean
    @Scope("singleton")
    public String test() {
        log.info("loading Frank!Flow beans");
        return "dummy";
    }

    @Bean
    @Scope("singleton")
    public ServletCreatorBean frontend() {
        return new ServletCreatorBean(BASEPATH + "*", FrontendServlet.class);
    }

    @Bean
    @Scope("singleton")
    public ServletCreatorBean backend() {
        Map<String, String> parameters = new HashMap<>();
        System.out.println("dfdfd");
        parameters.put("config-location", "ApiContext.xml");
        parameters.put("bus", "frank-flow-bus");
        return new ServletCreatorBean(BASEPATH + "api/*", BackendServlet.class, parameters);
    }
}
