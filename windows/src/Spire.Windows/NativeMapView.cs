using System.Globalization;
using System.Windows;
using System.Windows.Input;
using System.Windows.Media;
using Spire.Core;
namespace Spire.Windows;
// First-party native drawing; no browser, server or graph dependency.
public sealed class NativeMapView:FrameworkElement
{
 readonly NativeMapGraph graph;readonly IReadOnlyList<MapPoint3> points;
 readonly Dictionary<Guid,int> indices;readonly System.Diagnostics.Stopwatch clock=System.Diagnostics.Stopwatch.StartNew();
 double yaw,pitch,zoom=1;Point? pressed;bool moved;
 readonly Dictionary<Guid,Point> hit=new();
 public event Action<Guid>? FileOpened;
 public NativeMapView(NativeMapGraph graph)
 {
  this.graph=graph;points=NativeMapProjection.Sphere(graph.Nodes.Count);indices=graph.Nodes.Select((n,i)=>(n.Id,i)).ToDictionary(p=>p.Id,p=>p.i);
  Focusable=true;IsManipulationEnabled=true;
  Loaded+=(_,_)=>CompositionTarget.Rendering+=Frame;
  Unloaded+=(_,_)=>CompositionTarget.Rendering-=Frame;
  MouseLeftButtonDown+=(_,e)=>{pressed=e.GetPosition(this);moved=false;CaptureMouse();};
  MouseMove+=(_,e)=>{if(pressed is not Point previous)return;var p=e.GetPosition(this);var delta=p-previous;if(delta.Length>2)moved=true;yaw+=delta.X*0.008;pitch=Math.Clamp(pitch+delta.Y*0.008,-Math.PI/2,Math.PI/2);pressed=p;InvalidateVisual();};
  MouseLeftButtonUp+=(_,e)=>{ReleaseMouseCapture();pressed=null;if(moved)return;var p=e.GetPosition(this);var near=hit.OrderBy(h=>(h.Value-p).Length).FirstOrDefault();if(near.Key!=Guid.Empty&&(near.Value-p).Length<24)FileOpened?.Invoke(near.Key);};
  MouseWheel+=(_,e)=>{zoom=Math.Clamp(zoom*Math.Exp(e.Delta/1200d),0.25,4);e.Handled=true;InvalidateVisual();};
  ManipulationStarting+=(_,e)=>{e.ManipulationContainer=this;e.Mode=ManipulationModes.Translate|ManipulationModes.Scale;e.Handled=true;};
  ManipulationDelta+=(_,e)=>{yaw+=e.DeltaManipulation.Translation.X*0.008;pitch=Math.Clamp(pitch+e.DeltaManipulation.Translation.Y*0.008,-Math.PI/2,Math.PI/2);zoom=Math.Clamp(zoom*e.DeltaManipulation.Scale.X,0.25,4);e.Handled=true;InvalidateVisual();};
 }
 void Frame(object? sender,EventArgs e){if(IsVisible)InvalidateVisual();}
 protected override void OnRender(DrawingContext dc)
 {
  base.OnRender(dc);dc.DrawRectangle(new SolidColorBrush(Color.FromRgb(16,16,16)),null,new Rect(RenderSize));hit.Clear();
  if(ActualWidth<=0||ActualHeight<=0)return;
  MapPoint2 Project(MapPoint3 p)=>NativeMapProjection.Project(p,yaw,pitch,zoom,ActualWidth,ActualHeight);
  var projected=points.Select(Project).ToArray();
  foreach(var edge in graph.Edges)
  {
   var a=indices[edge.Source];var b=indices[edge.Target];var pa=projected[a];var pb=projected[b];
   dc.DrawLine(new Pen(new SolidColorBrush(Color.FromRgb(65,65,65)),1),new(pa.X,pa.Y),new(pb.X,pb.Y));
   var t=(clock.Elapsed.TotalSeconds*0.22+a*0.173)%1;var pulse=Project(NativeMapProjection.Pulse(points[a],points[b],t));dc.DrawEllipse(Brushes.White,null,new(pulse.X,pulse.Y),2.5,2.5);
  }
  foreach(var i in Enumerable.Range(0,points.Count).OrderBy(i=>projected[i].Depth))
  {
   var p=projected[i];var center=new Point(p.X,p.Y);hit[graph.Nodes[i].Id]=center;
   var opacity=0.35+(p.Depth+1)*0.3;dc.PushOpacity(opacity);dc.DrawEllipse(Brushes.White,null,center,4*p.Scale,4*p.Scale);
   var text=new FormattedText(graph.Nodes[i].Path.Split('/')[^1],CultureInfo.CurrentCulture,FlowDirection.LeftToRight,new Typeface("Segoe UI"),12,Brushes.White,VisualTreeHelper.GetDpi(this).PixelsPerDip);
   dc.DrawText(text,new(center.X+8,center.Y-8));dc.Pop();
  }
  var help=new FormattedText("Drag to rotate • Wheel / pinch to zoom • Click a file to open",CultureInfo.CurrentCulture,FlowDirection.LeftToRight,new Typeface("Segoe UI"),13,Brushes.Gray,VisualTreeHelper.GetDpi(this).PixelsPerDip);dc.DrawText(help,new(16,16));
 }
}
