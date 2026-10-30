package com.afterhours.blackjack;

import android.graphics.Bitmap;
import android.os.Bundle;
import android.os.SystemClock;
import android.view.MotionEvent;
import android.webkit.WebView;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.rule.ActivityTestRule;
import androidx.test.platform.app.InstrumentationRegistry;
import org.junit.Rule;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.json.*;
import java.io.*;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicReference;
import static org.junit.Assert.*;

@RunWith(AndroidJUnit4.class)
public class AndroidGameTest {
    @Rule public ActivityTestRule<MainActivity> activity=new ActivityTestRule<>(MainActivity.class);
    private String js(String script)throws Exception {
        long deadline=SystemClock.uptimeMillis()+120000;
        while(!activity.getActivity().pageLoaded && SystemClock.uptimeMillis()<deadline)SystemClock.sleep(100);
        CountDownLatch latch=new CountDownLatch(1);AtomicReference<String> result=new AtomicReference<>();
        activity.getActivity().runOnUiThread(()->activity.getActivity().web.evaluateJavascript(script,r->{result.set(r);latch.countDown();}));
        assertTrue("JavaScript callback timed out",latch.await(60,TimeUnit.SECONDS));return result.get();
    }
    private void waitFor(String condition)throws Exception {
        long deadline=SystemClock.uptimeMillis()+120000;
        while(SystemClock.uptimeMillis()<deadline){if("true".equals(js(condition)))return;SystemClock.sleep(150);}
        fail("Timed out: "+condition);
    }
    private void reload()throws Exception {
        InstrumentationRegistry.getInstrumentation().runOnMainSync(()->{activity.getActivity().pageLoaded=false;activity.getActivity().web.reload();});ready();
    }
    private void ready()throws Exception {waitFor("!!document.querySelector('#loader')?.hidden && !document.querySelector('#deal')?.disabled");if("true".equals(js("!!document.querySelector('#welcome') && !document.querySelector('#welcome').hidden"))){tap("#welcome-start");waitFor("document.querySelector('#welcome').hidden");}}
    private void tap(String selector)throws Exception {
        JSONObject rect=new JSONObject(js("(()=>{const r=document.querySelector('"+selector+"').getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2,w:innerWidth};})()"));
        WebView web=activity.getActivity().web;float scale=web.getWidth()/(float)rect.getDouble("w");
        float x=(float)rect.getDouble("x")*scale,y=(float)rect.getDouble("y")*scale;
        activity.getActivity().runOnUiThread(()->{long time=SystemClock.uptimeMillis();
            MotionEvent down=MotionEvent.obtain(time,time,MotionEvent.ACTION_DOWN,x,y,0);web.dispatchTouchEvent(down);down.recycle();
            MotionEvent up=MotionEvent.obtain(time,time+60,MotionEvent.ACTION_UP,x,y,0);web.dispatchTouchEvent(up);up.recycle();
        });
    }
    private void screenshot(String name)throws Exception {
        SystemClock.sleep(650);
        File folder=new File(activity.getActivity().getExternalFilesDir(null),"qa");folder.mkdirs();
        try(FileOutputStream out=new FileOutputStream(new File(folder,name+".png"))){
            Bitmap bitmap=InstrumentationRegistry.getInstrumentation().getUiAutomation().takeScreenshot();
            assertNotNull(bitmap);bitmap.compress(Bitmap.CompressFormat.PNG,100,out);bitmap.recycle();
        }
    }
    private void audit(String stage)throws Exception {
        String report=js("(()=>{const visible=e=>!e.hidden&&e.getClientRects().length&&getComputedStyle(e).display!=='none'&&getComputedStyle(e).visibility==='visible';const buttons=[...document.querySelectorAll('.board button')].filter(visible);return {stage:'"+stage+"',width:innerWidth,height:innerHeight,canvas:[...document.querySelectorAll('.canvas-viewport,.canvas-host,canvas')].map(e=>({name:e.className||e.tagName,w:e.clientWidth,scroll:e.scrollWidth,h:e.clientHeight,sh:e.scrollHeight})),overflow:document.documentElement.scrollWidth>innerWidth+1,small:buttons.filter(e=>{const r=e.getBoundingClientRect();return r.width<47.5||r.height<47.5}).map(e=>e.id||e.className),docks:[...document.querySelectorAll('.bet-area,.actions,.status-row')].map(e=>{const r=e.getBoundingClientRect();return {name:e.className,x:r.x,y:r.y,w:r.width,h:r.height}})}})()");
        JSONObject result=new JSONObject(report);assertFalse(report,result.getBoolean("overflow"));assertEquals(report,0,result.getJSONArray("small").length());
        android.util.Log.i("BlackjackQA",report);
    }
    @Test public void nativeRoundAndDialogs()throws Exception {
        ready();
        tap("#menu-open");waitFor("document.querySelector('#menu-dialog').open");
        tap("#reset-open");waitFor("document.querySelector('#reset-dialog').open");
        tap("#reset-confirm");waitFor("document.querySelector('#bank').textContent.replace(/\\D/g,'')==='2000'");
        audit("betting");screenshot("01-betting");
        tap("#bet-toggle");waitFor("document.querySelector('#bet-toggle').getAttribute('aria-expanded')==='true'");
        waitFor("Number(getComputedStyle(document.querySelector('#bet-panel')).opacity)>.999&&!document.querySelector('#bet-panel').getAnimations().some(a=>a.playState==='running')");
        tap("#bet-more");waitFor("document.querySelector('#wager').textContent==='110'");screenshot("00-bet-panel");
        activity.getActivity().runOnUiThread(()->activity.getActivity().onBackPressed());
        waitFor("document.querySelector('#bet-toggle').getAttribute('aria-expanded')==='false'");
        tap("#deal");waitFor("document.querySelector('#app').dataset.phase==='player'||document.querySelector('#app').dataset.phase==='result'");
        waitFor("document.querySelector('#bet-panel').inert&&(document.querySelector('#app').dataset.phase==='result'||getComputedStyle(document.querySelector('#bet-toggle')).visibility==='hidden')");
        audit("dealt");screenshot("02-dealt");
        if("\"player\"".equals(js("document.querySelector('#app').dataset.phase"))){tap("#stand");waitFor("document.querySelector('#app').dataset.phase==='result'");}
        screenshot("03-result");SystemClock.sleep(3800);screenshot("03b-idle");
        tap("#menu-open");waitFor("document.querySelector('#menu-dialog').open");
        tap("#settings-open");waitFor("document.querySelector('#settings-dialog').open");screenshot("04-settings");
        if("true".equals(js("document.querySelector('#pref-dialogue').checked")))tap("#pref-dialogue");
        waitFor("document.querySelector('#dealer-bubble').hidden");
        activity.getActivity().runOnUiThread(()->activity.getActivity().onBackPressed());
        waitFor("!document.querySelector('#settings-dialog').open");
        audit("after-back");reload();
        waitFor("document.querySelector('#dealer-bubble').hidden");
        tap("#menu-open");waitFor("document.querySelector('#menu-dialog').open");
        tap("#settings-open");waitFor("document.querySelector('#settings-dialog').open");
        tap("#pref-dialogue");waitFor("!document.querySelector('#dealer-bubble').hidden");
        activity.getActivity().runOnUiThread(()->activity.getActivity().onBackPressed());
    }
    @Test public void millionBankrollAndReload()throws Exception {
        ready();String old=js("localStorage.getItem('blackjack-bank-v1')");
        js("localStorage.setItem('blackjack-bank-v1','1000000');true");reload();
        waitFor("document.querySelector('#bank').textContent.replace(/\\D/g,'')==='1000000'");ready();
        audit("million");screenshot("05-million");
        js("document.querySelector('.canvas-viewport').scrollTop=99999;true");screenshot("06-million-bottom");
        js("localStorage.setItem('blackjack-bank-v1',"+("null".equals(old)?"'2000'":old)+");true");reload();

    }
    @Test public void corruptedHistoryAndTableSoundtrack()throws Exception {
        ready();
        String oldHistory=js("localStorage.getItem('blackjack-history-v1')");
        String oldSettings=js("localStorage.getItem('blackjack-settings-v1')");
        try {
            js("localStorage.setItem('blackjack-history-v1','{}');localStorage.setItem('blackjack-settings-v1',JSON.stringify({sound:false,fast:true}));true");
            reload();ready();
            js("window.__qaAudio=[];const originalPlay=HTMLMediaElement.prototype.play;HTMLMediaElement.prototype.play=function(){if(!window.__qaAudio.includes(this))window.__qaAudio.push(this);return originalPlay.call(this);};true");
            tap("#menu-open");waitFor("document.querySelector('#menu-dialog').open");
            tap("#sound");
            waitFor("window.__qaAudio.some(a=>a.src.endsWith('table-theme.mp3')&&!a.paused&&a.currentTime>.2)");
            assertEquals("true",js("window.__qaAudio[0].loop&&Math.abs(window.__qaAudio[0].duration-900)<1"));
            tap("#sound");waitFor("window.__qaAudio[0].paused");
            activity.getActivity().runOnUiThread(()->activity.getActivity().onBackPressed());
        } finally {
            js(("null".equals(oldHistory)?"localStorage.removeItem('blackjack-history-v1')":"localStorage.setItem('blackjack-history-v1',"+oldHistory+")")+";"+("null".equals(oldSettings)?"localStorage.removeItem('blackjack-settings-v1')":"localStorage.setItem('blackjack-settings-v1',"+oldSettings+")")+";true");
        }
    }

}
