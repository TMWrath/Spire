package com.tmwrath.spire;
import org.junit.Test;
import static org.junit.Assert.*;
public class AppActionsTest {
 @Test public void onlyExplicitActionsAreAllowed(){for(String action:new String[]{"leave","reload-confirmed","connection-confirmed","info","reload","print","connection","about"})assertTrue(AppActions.allowed(action));for(String action:new String[]{null,"","shell","reload();","INFO"})assertFalse(AppActions.allowed(action));}
 @Test public void originAndFrameMustBothMatch(){String server="https://spire.example";assertTrue(AppActions.trusted(server,server,true));assertFalse(AppActions.trusted(server,server,false));assertFalse(AppActions.trusted(server,"https://evil.example",true));assertFalse(AppActions.trusted(server,"http://spire.example",true));assertFalse(AppActions.trusted(server,"https://spire.example:444",true));}
}
