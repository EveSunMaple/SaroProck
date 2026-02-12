---
title: 【数据结构】Splay树
tags:
  - Splay
  - 平衡树
  - 伸展树
  - BST
  - 查找二叉树
  - OI
categories:
  - 技术
  - OI学习笔记
  - 数据结构
abbrlink: 7aad3841
pubDate: 2023-08-09 00:00:00
description: Splay树（伸展树）数据结构详解，包含旋转操作与区间操作
---

## 前言

Splay（伸展树）是一种灵活多变的高级数据结构，可以很方便的执行各种动态的区间操作。由丹尼尔·斯立特 Daniel Sleator 和罗伯特·恩卓·塔扬 Robert Endre Tarjan 在 1985 年发明。

Splay 是一颗二叉搜索树，它建立在二叉搜索树（BST）之上，当然也是平衡树的一种，下面简单介绍一下 BST 与平衡树：

首先介绍 BST，也就是所有平衡树的开始，他的名字是二叉查找树.

给定一棵二叉树，每一个节点有一个权值,命名为**关键码**，而 BST 性质就是，对于树中任何一个节点,都满足以下性质：

> 1.  这个节点的关键码不小于它的左子树上,任意一个节点的关键码
> 2.  这个节点的关键码不大于它的右子树上,任意一个节点的关键码

然后我们就可以发现这棵树的中序遍历，就是一个关键码单调递增的节点序列，说的直白点,就是一个排好序的数组（注意是非严格单调递增序列）。

我们知道，在一颗查找二叉树（BST）中，插入过程的均摊时间复杂度为$O(\log n)$，但是在一些特殊情况，BST 树会退化成一条链，导致时间复杂度从$O(\log n)$退化到$O(n)$，这是不可以的，所以产生了一种数据结构——`平衡树`。

平衡树最主要的功能就是`旋转` ，通过等价的旋转，可以最优化 BST 的深度，例如下面的两棵 BST 树的对比，他们实质上是等价的，但是第一颗不平衡，操作时会造成不必要的时间浪费。

![不平衡的树](https://img1.imgtp.com/2023/08/08/yP2oBg4X.svg)
![平衡的树](https://img1.imgtp.com/2023/08/08/tHb2MZof.svg)

当然除此之外，平衡树还有以下功能（来自[平衡树 - 维基百科](https://zh.wikipedia.org/wiki/%E5%B9%B3%E8%A1%A1%E6%A0%91)）：

> 1.  旋转（$rotate$）：几乎所有平衡树的操作都基于[树旋转](https://zh.wikipedia.org/wiki/%E6%A0%91%E6%97%8B%E8%BD%AC "树旋转")操作（也有部分基于重构，如[替罪羊树](https://zh.wikipedia.org/wiki/%E6%9B%BF%E7%BD%AA%E7%BE%8A%E6%A0%91 "替罪羊树")），通过旋转操作可以使得树趋于平衡。对一棵查找树（$search tree$）进行查询、新增、删除等动作，所花的时间与树的高度成比例，并不与树的容量成比例。如果可以让树维持平衡，也就是让高度维持在$O(\log⁡ n)$左右，就可以在$O(\log⁡ n)$的复杂度内完成各种基本操作。
> 2.  插入（$insert$）：在树中插入一个新值。
> 3.  删除（$delete$）：在树中删除一个值。
> 4.  查询前驱（$predecessor$）：前驱定义为小于$x$，且最大的数。
> 5.  查询后继（$successor$）：后继定义为大于$x$，且最小的数。
>     如果维护同时节点大小（$size$），还可以支持以下操作：
> 6.  查询排名（$rank$）：排名定义为比$x$小的数的个数加一。
> 7.  查询第$k$大：即排名为$k$的数。

那么实际上 Splay 树（伸展树）的原理是基于类似程序局部性原理的假设：一个节点在一次被访问后，这个节点很可能不久再次被访问。Splay 树的做法就是在每次一个节点被访问后，我们就把它推到树根的位置。正像程序局部性原理的实际效率被广泛证明一样，Splay 树在实际的搜索效率上也是非常高效的。尽管存在最坏情况下单次操作会花费$O(n)$的时间，但是这种情况并不是经常发生，而实际证明伸展树能够保证$m$次连续操作最多花费$O(m \log n)$的时间。

## Splay

所有平衡树的思路都是维护一颗 BST 树的`平衡状态`，也就是不改变中序遍历结果的前提之下，尽可能减少 Splay 树的深度。

前面我们说过了，Splay 的主要思想是：**对于查找频率较高的节点，使其处于离根节点相对较近的节点**。当然我们统计每一个点的查找次数是不现实的，我们可以理解每一次被查到的节点频率比较高，说白了就是你把每次查找到的点搬到根节点去，这样就可以保证查找的效率。

每次移动的过程就是旋转的过程（$rotate$），在 Splay 中有两种旋转，分别叫做`单旋`与`双旋`，我们将他们设计为$rotate$函数与$splay$函数。在设计之前，我们需要先定义一颗 BST 树，如下：

> 因为 OI 多是面向过程设计，下列写法并不在生产环境适用，若要应用于生产环境中，请使用 Class+指针面向对象设计 BST 树。

```cpp
struct Node
{
    int fa;    // 节点父亲
    int val;   // 节点权值
    int cnt;   // 权值出现次数
    int size;  // 子树大小
    int ch[2]; // 左儿子与右儿子（方便运算）
    Node()
    {
        fa = 0;
        val = 0;
        cnt = 0;
        size = 0;
        ch[0] = ch[1] = 0;
    }
    Node(int Fa, int Val, int Cnt, int Size, int R, int L)
    {
        fa = Fa;
        val = Val;
        cnt = Cnt;
        size = Size;
        ch[0] = L;
        ch[1] = R;
    }
} tree[N];
```

### 设计旋转

#### 单旋（rotate）

首先考虑一下，我们要把一个点挪到根，那我们首先要知道怎么让一个点挪到它的父节点。单旋函数就是这个功能。

##### 情况一

考虑下面的情况，我们要把节点 3 移动到它的父亲节点 2 之上（字母节点代表一颗子树）：

![](https://img1.imgtp.com/2023/08/09/WILfOT7w.png)

这时候如果我们让 X 成为 Y 的父亲，只会影响到 3 个点的关系：

> Y 与 3，3 与 2，3 与 1
> 根据二叉排序树的性质
> Y 会成为 2 的左儿子
> 2 会成为 3 的右儿子
> 3 会成为 1 的儿子（与原来 2 与 1 的情况相同）

经过变换之后，大概是这样：

![](https://img1.imgtp.com/2023/08/09/86N2zOFC.png)

##### 情况二

那么反过来，我们把这个时候的节点 2 移到 3 节点之上，与第一个图是相同的，这就是第二种情况。

##### 代码

首先我们写一个$get$函数，以获取此节点是其父亲的哪一个儿子：

```cpp
bool get(int x) { return x == tree[x].ch[1]; }
```

我们假设是从 u->v，设计函数$rotate$如下：

```cpp
void rotate(int u, int v)
{
    int u_fa = tree[u].fa; // u_fa = v;
    int v_fa = tree[v].fa; // u的目标父亲
    int son_u = get(u);    // u在其父亲的位置
    int son_v = get(v);    // v在其父亲的位置
}
```

观察上图，我们发现节点 3 的 Y 子树的父亲更改了，可以发现下面两个规律：

> 1.  Y 子树的位置与 3 在 2 中的位置相反
> 2.  Y 子树在 2 的目标位置与 3 在 2 中的位置相同

那么我们先获取 Y 子树的位置，然后再把这几个要改变的点相互连接就好了：

```cpp
void rotate(int u)
{
    int v = tree[u].fa;
    // int u_fa = tree[u].fa;           // u_fa = v;
    int v_fa = tree[v].fa;              // u的目标父亲
    int son_u = get(u);                 // u在其父亲的位置
    int son_v = get(v);                 // v在其父亲的位置
    int change = tree[u].ch[son_u ^ 1]; // 获取u中需要更改的子树节点
    // 把这颗子树接到v的u位置：
    tree[change].fa = v;
    tree[v].ch[son_u] = change;
    // 把v接到u中不同的位置
    tree[v].fa = u;
    tree[u].ch[son_u ^ 1] = v;
    // 把u接到v原来的父亲中
    tree[u].fa = v_fa;
    tree[v_fa].ch[son_v] = u;
}
```

#### 双旋（splay）

$splay(u,v)$是实现把 u 节点直接搬到 v 节点。

最简单的办法，对于 u 这个节点，每次单旋直到 v。

但是，众所周知出题老师拥有极强的卡时能力，可能会构造数据把单旋卡成$n^2$，具体原因我也不清楚啦，反正不要这样用就好了，下面我们来写$splay$函数吧~

> OI-Wiki 把$splay$分成了六种情况啊！六种！太麻烦了，实际上就三种啦。

##### 情况一

我们的目标节点 v 就是 u 的父亲，那么就直接$rotate$吧！

##### 情况二

三个点连成了一条线……

![](https://img1.imgtp.com/2023/08/09/nEH2Djho.png)

这时候先把 2 旋转上去，再把 3 旋转上去就好了

```cpp
else if (get(u) == get(tree[u].fa)) rotate(tree[u].fa), rotate(x);
```

##### 情况三

三个点歪七扭八，不知道是什么东西……

![](https://img1.imgtp.com/2023/08/09/nMcNiWs3.png)

这时候把 3 旋转两次就好啦

##### 代码

全部代码如下：

```cpp
void splay(int u, int v)
{
    v = tree[v].fa; // 方便写下面的代码
    while (tree[u].fa != v)
    {
        if (tree[tree[u].fa].fa == v) rotate(u);
        else if (get(u) == get(tree[u].fa)) rotate(tree[u].fa), rotate(x);
        else rotate(u), rotate(u);
    }
}
```

### 功能函数

Splay 最伟大的两个函数写好了，我们就要实现他作为一颗 BST 树的功能了，一个一个来，我们慢慢讲，因为下面的内容可能还需要修改上面的两个旋转函数。

#### 清空节点

```cpp
void clear(int u) { tree[u].ch[0] = tree[u].ch[1] = tree[u].fa = tree[u].fa = tree[u].size = tree[u].cnt = 0; }
```

#### 维护 Size

```cpp
void maintain(int u) { tree[u].size = tree[tree[u].ch[0]].size + tree[tree[u].ch[1]].size + tree[u].cnt; }
```

我们每一次旋转都会改变节点的 Size 值，因此要在$rotate$函数的最后添加这两句：

```cpp
maintain(u); // 维护u的size
maintain(v); // 维护v的size
```

最后完成的$rotate$函数如下：

```cpp
void rotate(int u)
{
    int v = tree[u].fa;
    // int u_fa = tree[u].fa;           // u_fa = v;
    int v_fa = tree[v].fa;              // u的目标父亲
    int son_u = get(u);                 // u在其父亲的位置
    int son_v = get(v);                 // v在其父亲的位置
    int change = tree[u].ch[son_u ^ 1]; // 获取u中需要更改的子树节点
    // 把这颗子树接到v的u位置：
    tree[change].fa = v;
    tree[v].ch[son_u] = change;
    // 把v接到u中不同的位置
    tree[v].fa = u;
    tree[u].ch[son_u ^ 1] = v;
    // 把u接到v原来的父亲中
    tree[u].fa = v_fa;
    tree[v_fa].ch[son_v] = u;
    maintain(u); // 维护u的size
    maintain(v); // 维护v的size
}
```

#### 插入操作

插入操作是一个比较复杂的过程，具体步骤如下（假设插入的值为 $k$）：

> - 如果树空了，则直接插入根并退出。
> - 如果当前节点的权值等于 $k$ 则增加当前节点的大小并更新节点和父亲的信息，将当前节点进行 Splay 操作。
> - 否则按照二叉查找树的性质向下找，找到空节点就插入即可（请不要忘记 Splay 操作）。

我们定义一个新变量`root`，来代表根节点的位置。

实现代码如下：

```cpp
void insert(int k)
{
    int now = root; // 从根节点开始
    if (root == 0)  // 如果没有根节点就新建一个
    {
        tree[++tot].fa = 0;                 // 根节点没有父亲
        tree[tot].val = k;                  // 初始化值
        tree[tot].cnt = tree[tot].size = 1; // 初始化cnt与size
        root = tot;                         // 把根定为现在加入的新节点
    }
    else
    {
        while (1)
        {
            tree[now].size++;       // 走过这个点，代表它的大小增加了
            if (tree[now].val == k) // 如果k值与这个点相同，就放进去
            {
                tree[now].cnt++;  // 值的个数加一
                splay(now, root); // 把更新的点旋转到根
                return;
            }
            int nxt = k < tree[now].val ? 0 : 1; // 按照BST找节点
            if (!tree[now].ch[nxt])              // 如果找不到就加一个新的
            {
                tree[++tot].fa = now;               // 新节点的父亲就是当前的
                tree[tot].val = k;                  // 初始化值
                tree[tot].cnt = tree[tot].size = 1; // 初始化cnt与size
                tree[now].ch[nxt] = tot;            // 加入当前节点的儿子
                splay(tot, root);                   // 把新节点移动到根
                return;
            }
            now = tree[now].ch[nxt]; // 向下走
        }
    }
}
```

同时还要注意每一次 Splay 是把当前节点移动到根，所以要在$splay$最后更新`root`。

```cpp
void splay(int u, int v)
{
    v = tree[v].fa; // 方便写下面的代码
    while (tree[u].fa != v)
    {
        if (tree[tree[u].fa].fa == v) rotate(u);
        else if (get(u) == get(tree[u].fa)) rotate(tree[u].fa), rotate(x);
        else rotate(u), rotate(u);
        root = u;
    }
}
```

#### 查询 k 的排名

根据二叉查找树的定义和性质，显然可以按照以下步骤查询 $k$ 的排名：

> - 如果 $k$ 比当前节点的权值小，向其左子树查找。
> - 如果 $k$ 比当前节点的权值大，将答案加上左子树$size$和当前节点$cnt$的大小，向其右子树查找。
> - 如果 $k$ 与当前节点的权值相同，将答案加$1$并返回。

实现代码如下：

```cpp
int rank(int k)
{
    int ans = 0;    // 累计答案
    int now = root; // 从根开始
    while (1)
    {
        if (k < tree[now].val) // 如果比它小就向左找
        {
            now = tree[now].ch[0];
        }
        else
        {
            ans += tree[tree[now].ch[0]].size; // 否则加上左子树的大小
            if (k == tree[now].val)             // 如果找到了
            {
                splay(now, root); // 把找到的节点移动到根
                return ans + 1;   // 返回答案
            }
            ans += tree[now].cnt;  // 否则加上这个点的权值数
            now = tree[now].ch[1]; // 然后继续向右找
        }
    }
}
```

#### 查询排名 k 的数

设 $k$ 为剩余排名，具体步骤如下：

> - 如果左子树非空且剩余排名 $k$ 不大于左子树的大小 $size$，那么向左子树查找。
> - 否则将 $k$ 减去左子树的和根的大小。如果此时 $k$ 的值小于等于 $0$，则返回根节点的权值，否则继续向右子树查找。

实现代码如下：

```cpp
int kth(int k)
{
    int now = root; // 从根开始
    while (1)
    {
        if (tree[now].ch[0] && k <= tree[tree[now].ch[0]].size) // 如果在左子树中
        {
            now = tree[now].ch[0]; // 向左找
        }
        else
        {
            k -= tree[now].cnt + tree[tree[now].ch[0]].size; // 减去当前的和左子树的和
            if (k <= 0)                                      // 如果减完了，说明在当前节点
            {
                splay(now, root);     // 把找到的节点移动到根
                return tree[now].val; // 返回真实值
            }
            now = tree[now].ch[1]; // 否则继续向右找
        }
    }
}
```

#### 查询前驱

> 前驱定义为小于 $x$ 的最大的数，那么查询前驱可以转化为：将 $x$ 插入（此时 $x$ 已经在根的位置了），前驱即为 $x$ 的左子树中最右边的节点，最后将 $x$ 删除即可。

实现代码如下：

```cpp
int pre()
{
    int now = tree[root].ch[0];
    if (!now) return now;                          // 如果没有左子树，直接返回
    while (tree[now].ch[1]) now = tree[now].ch[1]; // 在左子树中一直向右走
    splay(now, root);               // 把找到的节点移动到根
    return now;
}
```

#### 查询后继

> 后继定义为大于 $x$ 的最小的数，查询方法和前驱类似：$x$ 的右子树中最左边的节点。

实现代码如下：

```cpp
int nxt()
{
    int now = tree[root].ch[1];
    if (!now) return now;                          // 如果没有右子树，直接返回
    while (tree[now].ch[0]) now = tree[now].ch[0]; // 在右子树中一直向左走
    splay(now, root);                              // 把找到的节点移动到根
    return now;
}
```

#### 删除操作

删除操作也是一个比较复杂的操作，具体步骤如下：

> 首先将 $x$ 旋转到根的位置。
>
> - 如果 （有不止一个 $x$），那么将 $tree[x].cnt$ 减 $1$ 并退出。
> - 否则，合并它的左右两棵子树即可。

```cpp
void del(int k)
{
    rank(k);
    if (tree[root].cnt > 1) // 如果此节点数量足够
    {
        tree[root].cnt--; // 仅仅把cnt减一
        maintain(root);
        return;
    }
    if (!tree[root].ch[0] && !tree[root].ch[1]) // 如果只有一个点
    {
        clear(root); // 直接删掉
        root = 0;
        return;
    }
    if (!tree[root].ch[0]) // 如果没有左子树
    {
        int now = root;          // 从根开始
        root = tree[root].ch[1]; // 定义新根为右儿子
        tree[root].fa = 0;       // 重置父亲
        clear(now);              // 删掉原来的根
        return;
    }
    if (!tree[root].ch[1]) // 如果没有右子树
    {
        int now = root;          // 从根开始
        root = tree[root].ch[0]; // 定义新根为左儿子
        tree[root].fa = 0;       // 重置父亲
        clear(now);              // 删掉原来的根
        return;
    }
    // 如果左右子树都存在
    int now = root, x = pre();       // 从根开始，同时获得新根
    tree[tree[now].ch[1]].fa = x;    // 定义原根右儿子的父亲为新根
    tree[x].ch[1] = tree[now].ch[1]; // 定义新根的右儿子为原根右儿子
    clear(now);                      // 删掉原来的根
    maintain(root);                  // 重置新根
}
```

## 最终 Splay 模板

```cpp
#include <iostream>
#include <cstring>
#include <cstdio>
#define N 100005

using namespace std;

struct Node
{
    int fa;    // 节点父亲
    int val;   // 节点权值
    int cnt;   // 权值出现次数
    int size;  // 子树大小
    int ch[2]; // 左儿子与右儿子（方便运算）
    Node()
    {
        fa = 0;
        val = 0;
        cnt = 0;
        size = 0;
        ch[0] = ch[1] = 0;
    }
    Node(int Fa, int Val, int Cnt, int Size, int R, int L)
    {
        fa = Fa;
        val = Val;
        cnt = Cnt;
        size = Size;
        ch[0] = L;
        ch[1] = R;
    }
} tree[N];
int tot;  // 不算重的节点个数
int root; // 根节点

bool get(int u) { return u == tree[u].ch[1]; }

void maintain(int u) { tree[u].size = tree[tree[u].ch[0]].size + tree[tree[u].ch[1]].size + tree[u].cnt; }

void clear(int u) { tree[u].ch[0] = tree[u].ch[1] = tree[u].fa = tree[u].fa = tree[u].size = tree[u].cnt = 0; }

void rotate(int u)
{
    int v = tree[u].fa;
    // int u_fa = tree[u].fa;           // u_fa = v;
    int v_fa = tree[v].fa;              // u的目标父亲
    int son_u = get(u);                 // u在其父亲的位置
    int son_v = get(v);                 // v在其父亲的位置
    int change = tree[u].ch[son_u ^ 1]; // 获取u中需要更改的子树节点
    // 把这颗子树接到v的u位置：
    tree[change].fa = v;
    tree[v].ch[son_u] = change;
    // 把v接到u中不同的位置
    tree[v].fa = u;
    tree[u].ch[son_u ^ 1] = v;
    // 把u接到v原来的父亲中
    tree[u].fa = v_fa;
    tree[v_fa].ch[son_v] = u;
    maintain(u); // 维护u的size
    maintain(v); // 维护v的size
}

void splay(int u, int v)
{
    v = tree[v].fa; // 方便写下面的代码
    while (tree[u].fa != v)
    {
        if (tree[tree[u].fa].fa == v) rotate(u);
        else if (get(u) == get(tree[u].fa)) rotate(tree[u].fa), rotate(x);
        else rotate(u), rotate(u);
        root = u;
    }
}

void insert(int k)
{
    int now = root; // 从根节点开始
    if (root == 0)  // 如果没有根节点就新建一个
    {
        tree[++tot].fa = 0;                 // 根节点没有父亲
        tree[tot].val = k;                  // 初始化值
        tree[tot].cnt = tree[tot].size = 1; // 初始化cnt与size
        root = tot;                         // 把根定为现在加入的新节点
    }
    else
    {
        while (1)
        {
            tree[now].size++;       // 走过这个点，代表它的大小增加了
            if (tree[now].val == k) // 如果k值与这个点相同，就放进去
            {
                tree[now].cnt++;  // 值的个数加一
                splay(now, root); // 把更新的点旋转到根
                return;
            }
            int nxt = k < tree[now].val ? 0 : 1; // 按照BST找节点
            if (!tree[now].ch[nxt])              // 如果找不到就加一个新的
            {
                tree[++tot].fa = now;               // 新节点的父亲就是当前的
                tree[tot].val = k;                  // 初始化值
                tree[tot].cnt = tree[tot].size = 1; // 初始化cnt与size
                tree[now].ch[nxt] = tot;            // 加入当前节点的儿子
                splay(tot, root);                   // 把新节点移动到根
                return;
            }
            now = tree[now].ch[nxt]; // 向下走
        }
    }
}

int rank(int k)
{
    int ans = 0;    // 累计答案
    int now = root; // 从根开始
    while (1)
    {
        if (k < tree[now].val) // 如果比它小就向左找
        {
            now = tree[now].ch[0];
        }
        else
        {
            ans += tree[tree[now].ch[0]].size; // 否则加上左子树的大小
            if (k == tree[now].val)             // 如果找到了
            {
                splay(now, root); // 把找到的节点移动到根
                return ans + 1;   // 返回答案
            }
            ans += tree[now].cnt;  // 否则加上这个点的权值数
            now = tree[now].ch[1]; // 然后继续向右找
        }
    }
}

int kth(int k)
{
    int now = root; // 从根开始
    while (1)
    {
        if (tree[now].ch[0] && k <= tree[tree[now].ch[0]].size) // 如果在左子树中
        {
            now = tree[now].ch[0]; // 向左找
        }
        else
        {
            k -= tree[now].cnt + tree[tree[now].ch[0]].size; // 减去当前的和左子树的和
            if (k <= 0)                                      // 如果减完了，说明在当前节点
            {
                splay(now, root);     // 把找到的节点移动到根
                return tree[now].val; // 返回真实值
            }
            now = tree[now].ch[1]; // 否则继续向右找
        }
    }
}

int pre()
{
    int now = tree[root].ch[0];
    if (!now) return now;                          // 如果没有左子树，直接返回
    while (tree[now].ch[1]) now = tree[now].ch[1]; // 在左子树中一直向右走
    splay(now, root);                              // 把找到的节点移动到根
    return now;
}

int nxt()
{
    int now = tree[root].ch[1];
    if (!now) return now;                          // 如果没有右子树，直接返回
    while (tree[now].ch[0]) now = tree[now].ch[0]; // 在右子树中一直向左走
    splay(now, root);                              // 把找到的节点移动到根
    return now;
}

void del(int k)
{
    rank(k);
    if (tree[root].cnt > 1) // 如果此节点数量足够
    {
        tree[root].cnt--; // 仅仅把cnt减一
        maintain(root);
        return;
    }
    if (!tree[root].ch[0] && !tree[root].ch[1]) // 如果只有一个点
    {
        clear(root); // 直接删掉
        root = 0;
        return;
    }
    if (!tree[root].ch[0]) // 如果没有左子树
    {
        int now = root;          // 从根开始
        root = tree[root].ch[1]; // 定义新根为右儿子
        tree[root].fa = 0;       // 重置父亲
        clear(now);              // 删掉原来的根
        return;
    }
    if (!tree[root].ch[1]) // 如果没有右子树
    {
        int now = root;          // 从根开始
        root = tree[root].ch[0]; // 定义新根为左儿子
        tree[root].fa = 0;       // 重置父亲
        clear(now);              // 删掉原来的根
        return;
    }
    // 如果左右子树都存在
    int now = root, x = pre();       // 从根开始，同时获得新根
    tree[tree[now].ch[1]].fa = x;    // 定义原根右儿子的父亲为新根
    tree[x].ch[1] = tree[now].ch[1]; // 定义新根的右儿子为原根右儿子
    clear(now);                      // 删掉原来的根
    maintain(root);                  // 重置新根
}

int main()
{
    return 0;
}
```
