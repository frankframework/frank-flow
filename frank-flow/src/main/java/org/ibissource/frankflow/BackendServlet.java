/*
   Copyright 2024 WeAreFrank!

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

import org.springframework.context.ApplicationContext;
import org.springframework.util.ResourceUtils;
import org.springframework.web.servlet.DispatcherServlet;

public class BackendServlet extends DispatcherServlet {
	private static final long serialVersionUID = 4L;

	BackendServlet() {
		setContextConfigLocation(ResourceUtils.CLASSPATH_URL_PREFIX + "/mvc-dispatcher-config.xml");
		setDetectAllHandlerMappings(false);
	}

	@Override
	public void setApplicationContext(ApplicationContext applicationContext) {
		//don't wire/inherit the ApplicationContext, let it create it's own context
	}
}
