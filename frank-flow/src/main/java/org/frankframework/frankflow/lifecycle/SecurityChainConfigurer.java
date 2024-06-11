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
package org.frankframework.frankflow.lifecycle;

import java.util.ArrayList;
import java.util.List;
import java.util.Set;

import org.frankframework.lifecycle.DynamicRegistration.Servlet;
import org.springframework.context.ApplicationContext;
import org.springframework.context.ApplicationContextAware;
import org.springframework.context.EnvironmentAware;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.core.env.Environment;
import org.springframework.security.authorization.AuthenticatedAuthorizationManager;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.annotation.web.configurers.CsrfConfigurer;
import org.springframework.security.config.annotation.web.configurers.FormLoginConfigurer;
import org.springframework.security.config.annotation.web.configurers.HeadersConfigurer;
import org.springframework.security.config.annotation.web.configurers.LogoutConfigurer;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.util.matcher.AnyRequestMatcher;
import org.springframework.security.web.util.matcher.RequestMatcher;

import lombok.Setter;

/**
 * Enable security, although.. it's anonymous on all endpoints, but at least sets the 
 * <code>SecurityContextHolder.getContext().getAuthentication();</code> object.
 */
@Configuration
@EnableWebSecurity //Enables Spring Security (classpath)
@EnableMethodSecurity(jsr250Enabled = true, prePostEnabled = false) //Enables JSR 250 (JAX-RS) annotations
@Order(Ordered.HIGHEST_PRECEDENCE)
public class SecurityChainConfigurer implements ApplicationContextAware, EnvironmentAware {
	private @Setter ApplicationContext applicationContext;
	private @Setter Environment environment;

	@Bean
	public SecurityFilterChain configureChain(HttpSecurity http) throws Exception {
		//Apply defaults to disable bloated filters, see DefaultSecurityFilterChain.getFilters for the actual list.
		http.headers(headers -> headers.frameOptions(HeadersConfigurer.FrameOptionsConfig::sameOrigin)); //Allow same origin iframe request
		http.csrf(CsrfConfigurer::disable);
		RequestMatcher securityRequestMatcher = AnyRequestMatcher.INSTANCE;
		http.securityMatcher(securityRequestMatcher); //Triggers the SecurityFilterChain, also for OPTIONS requests!
		http.formLogin(FormLoginConfigurer::disable); //Disable the form login filter
		http.logout(LogoutConfigurer::disable); //Disable the logout endpoint on every filter

		http.anonymous(anonymous -> anonymous.authorities(getAuthorities()));

		// Enables security for all servlet endpoints
		http.authorizeHttpRequests(requests -> requests.requestMatchers(securityRequestMatcher).access(AuthenticatedAuthorizationManager.anonymous()));

		return http.build();
	}

	private List<GrantedAuthority> getAuthorities() {
		Set<String> securityRoles = Set.of(Servlet.ALL_IBIS_USER_ROLES);
		List<GrantedAuthority> grantedAuthorities = new ArrayList<>(securityRoles.size());
		for (String role : securityRoles) {
			grantedAuthorities.add(new SimpleGrantedAuthority("ROLE_" + role));
		}
		return grantedAuthorities;
	}
}
